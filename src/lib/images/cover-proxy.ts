/**
 * @packageDocumentation
 *
 * Recipe cover photos live on other people's websites. Loading them straight
 * from there is slow (a new connection per site, full-size files), leaks which
 * recipes you open to every site (referrers, cookies), and breaks when a site
 * blocks hotlinking. So the pages ask our own `/api/cover-images` for them: it
 * fetches the photo once, scales it down where Cloudflare can, and keeps a copy
 * at the edge. This module is the shared, testable part: building those
 * addresses, deciding which addresses are safe to fetch, and fetching one.
 */

/** The widths (in pixels) a page may ask for; anything else snaps to the nearest. */
export const COVER_WIDTHS = [320, 480, 640, 960, 1280] as const;

/** The most a cover photo may weigh before we refuse it. */
export const MAX_COVER_BYTES = 10 * 1024 * 1024;

/** The nearest allowed width at or above `width` (the largest if none is). */
export function snapWidth(width: number): number {
  return (
    COVER_WIDTHS.find((w) => w >= width) ??
    COVER_WIDTHS[COVER_WIDTHS.length - 1]!
  );
}

/** Our address for a cover photo at one width. */
export function coverSrc(url: string, width: number): string {
  return `/api/cover-images?url=${encodeURIComponent(url)}&w=${snapWidth(width)}`;
}

/** A `srcset` of our addresses for a cover photo, one per width. */
export function coverSrcSet(
  url: string,
  widths: readonly number[] = COVER_WIDTHS,
): string {
  return widths.map((w) => `${coverSrc(url, w)} ${snapWidth(w)}w`).join(', ');
}

/** Whether an IPv4 address is private, loopback or otherwise not for the web. */
function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/**
 * Whether an address is a public web image we are willing to fetch: http or
 * https on the usual ports, with a real hostname — not an IP address, not
 * `localhost` and not an internal name. This keeps the proxy from being aimed
 * at anything inside a network.
 */
export function isFetchableImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    return false;
  }
  if (url.username || url.password) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (
    !host.includes('.') ||
    host.startsWith('[') ||
    /^[\d.]+$/.test(host) ||
    isPrivateIPv4(host) ||
    /\.(local|localhost|internal|lan|home|corp|test|invalid|example)$/.test(
      host,
    ) ||
    host === 'localhost'
  ) {
    return false;
  }
  return true;
}

/** How long a photo may be kept, by us and by the browser. */
const KEEP_SECONDS = 7 * 24 * 60 * 60;

/** What fetching a cover gave: the image to send on, or why not. */
export type CoverResult =
  | { ok: true; response: Response }
  | { ok: false; status: 400 | 404 | 413 | 415 | 502; reason: string };

/** The fetch function, narrowed to what the proxy needs, so tests can fake it. */
export type CoverFetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * The part of Cloudflare's Images binding the proxy uses (scale an image, encode
 * it as WebP), so tests can fake it. The binding needs no zone settings, only
 * the `images` entry in `wrangler.jsonc`.
 */
export interface ImagesLike {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; fit: 'scale-down' }): {
      output(options: {
        format: 'image/webp';
        quality: number;
      }): Promise<{ response(): Response }>;
    };
  };
}

/** Photos smaller than this are already light; scaling them gains nothing. */
const SCALE_FROM_BYTES = 24 * 1024;

/** Formats worth scaling. (A GIF may be animated, which scaling would flatten.) */
const SCALABLE = /^image\/(jpeg|jpg|png|webp|avif)$/;

/** The headers every cover we send carries. */
function coverHeaders(type: string): HeadersInit {
  return {
    'Content-Type': type,
    // A sealed, script-free image: if one were ever opened as a page, it could
    // do nothing.
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': `public, max-age=${KEEP_SECONDS}, immutable`,
  };
}

/**
 * Fetch one cover photo for the proxy. Only real, reasonably small raster images
 * are accepted: never SVG (which can carry script), never an HTML page. Where the
 * Images binding is available the photo is scaled down to `width` and sent as
 * WebP, typically a tenth of the original's weight; if scaling fails the
 * original is passed through, so a photo is never lost to an optimisation.
 */
export async function fetchCover(
  url: string,
  width: number,
  deps: { fetcher?: CoverFetch; images?: ImagesLike } = {},
): Promise<CoverResult> {
  const fetcher = deps.fetcher ?? (fetch as CoverFetch);
  if (!isFetchableImageUrl(url)) {
    return { ok: false, status: 400, reason: 'Not a fetchable image address.' };
  }
  let upstream: Response;
  try {
    upstream = await fetcher(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*;q=0.8',
        'User-Agent': 'chowdown-cover-proxy/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      // Cloudflare-only: keep the original at the edge, ignored elsewhere.
      cf: { cacheEverything: true, cacheTtl: KEEP_SECONDS },
    } as unknown as RequestInit);
  } catch {
    return { ok: false, status: 502, reason: 'The image site did not answer.' };
  }
  if (upstream.status === 404 || upstream.status === 410) {
    return { ok: false, status: 404, reason: 'The image is gone.' };
  }
  if (!upstream.ok) {
    return { ok: false, status: 502, reason: 'The image site refused.' };
  }
  const type = (upstream.headers.get('content-type') ?? '')
    .toLowerCase()
    .split(';')[0]!
    .trim();
  if (!type.startsWith('image/') || type.startsWith('image/svg')) {
    return { ok: false, status: 415, reason: 'That address is not a photo.' };
  }
  if (Number(upstream.headers.get('content-length') ?? 0) > MAX_COVER_BYTES) {
    return { ok: false, status: 413, reason: 'The photo is too large.' };
  }
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_COVER_BYTES) {
    return { ok: false, status: 413, reason: 'The photo is too large.' };
  }
  if (
    deps.images &&
    SCALABLE.test(type) &&
    bytes.byteLength > SCALE_FROM_BYTES
  ) {
    try {
      const scaled = await deps.images
        .input(new Response(bytes).body!)
        .transform({ width: snapWidth(width), fit: 'scale-down' })
        .output({ format: 'image/webp', quality: 75 });
      const response = scaled.response();
      // Only keep the result if it is really smaller than the original.
      const out = await response.arrayBuffer();
      if (out.byteLength > 0 && out.byteLength < bytes.byteLength) {
        return {
          ok: true,
          response: new Response(out, { headers: coverHeaders('image/webp') }),
        };
      }
    } catch {
      // Fall through to the original.
    }
  }
  return {
    ok: true,
    response: new Response(bytes, { headers: coverHeaders(type) }),
  };
}
