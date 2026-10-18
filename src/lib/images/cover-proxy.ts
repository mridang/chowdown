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
 * Fetch one cover photo for the proxy. Cloudflare scales and re-encodes it to
 * `width` where it can (`cf.image`); where it can't, the original comes back and
 * is passed through. Only real, reasonably small raster images are accepted:
 * never SVG (which can carry script), never an HTML page.
 */
export async function fetchCover(
  url: string,
  width: number,
  fetcher: CoverFetch = fetch as CoverFetch,
): Promise<CoverResult> {
  if (!isFetchableImageUrl(url)) {
    return { ok: false, status: 400, reason: 'Not a fetchable image address.' };
  }
  const headers = {
    Accept: 'image/avif,image/webp,image/apng,image/*;q=0.8',
    'User-Agent': 'chowdown-cover-proxy/1.0',
  };
  const attempt = (scaled: boolean) =>
    fetcher(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      // Cloudflare-only options, ignored elsewhere. Scaling needs Image
      // Transformations switched on for the zone; without it the request can
      // fail, hence the second, plain attempt below.
      cf: {
        ...(scaled
          ? {
              image: {
                width: snapWidth(width),
                quality: 75,
                fit: 'scale-down',
                format: 'auto',
              },
            }
          : {}),
        cacheEverything: true,
        cacheTtl: KEEP_SECONDS,
      },
    } as unknown as RequestInit);
  let upstream: Response;
  try {
    upstream = await attempt(true);
    if (!upstream.ok && upstream.status !== 404 && upstream.status !== 410) {
      upstream = await attempt(false);
    }
  } catch {
    try {
      upstream = await attempt(false);
    } catch {
      return {
        ok: false,
        status: 502,
        reason: 'The image site did not answer.',
      };
    }
  }
  if (upstream.status === 404 || upstream.status === 410) {
    return { ok: false, status: 404, reason: 'The image is gone.' };
  }
  if (!upstream.ok) {
    return { ok: false, status: 502, reason: 'The image site refused.' };
  }
  const type = (upstream.headers.get('content-type') ?? '').toLowerCase();
  if (!type.startsWith('image/') || type.startsWith('image/svg')) {
    return { ok: false, status: 415, reason: 'That address is not a photo.' };
  }
  const length = Number(upstream.headers.get('content-length') ?? 0);
  if (length > MAX_COVER_BYTES) {
    return { ok: false, status: 413, reason: 'The photo is too large.' };
  }
  return {
    ok: true,
    response: new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': type.split(';')[0]!,
        // A sealed, script-free image: if one were ever opened as a page, it
        // could do nothing.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': `public, max-age=${KEEP_SECONDS}, immutable`,
      },
    }),
  };
}
