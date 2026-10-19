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

import {
  fetchCapped,
  isPublicWebUrl,
  type FetchFailure,
  type SafeFetcher,
  type SafeRequestInit,
} from '../http/safe-fetch';

/** The largest width a page may ask for, in pixels. */
const LARGEST_WIDTH = 1280;

/** The widths (in pixels) a page may ask for; anything else snaps to the nearest. */
export const COVER_WIDTHS = [320, 480, 640, 960, LARGEST_WIDTH] as const;

/** The most a cover photo may weigh before we refuse it. */
export const MAX_COVER_BYTES = 10 * 1024 * 1024;

/** The nearest allowed width at or above `width` (the largest if none is). */
export function snapWidth(width: number): number {
  return COVER_WIDTHS.find((w) => w >= width) ?? LARGEST_WIDTH;
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

/**
 * Whether an address is a public web image we are willing to fetch: http or
 * https on the usual ports, with a real hostname — not an IP address, not
 * `localhost` and not an internal name. This keeps the proxy from being aimed
 * at anything inside a network. (The same rule every outbound fetch follows,
 * see `http/safe-fetch.ts`.)
 */
export function isFetchableImageUrl(value: string): boolean {
  return isPublicWebUrl(value);
}

/** How long a photo may be kept, by us and by the browser. */
const KEEP_SECONDS = 7 * 24 * 60 * 60;

/** What fetching a cover gave: the image to send on, or why not. */
export type CoverResult =
  | { readonly ok: true; readonly response: Response }
  | {
      readonly ok: false;
      readonly status: 400 | 404 | 413 | 415 | 502;
      readonly reason: string;
    };

/** Request options plus Cloudflare's `cf` extension, which other runtimes ignore. */
export type CoverRequestInit = SafeRequestInit;

/** The fetch function, narrowed to what the proxy needs, so tests can fake it. */
export type CoverFetch = SafeFetcher;

/**
 * The part of Cloudflare's Images binding the proxy uses (scale an image, encode
 * it as WebP), so tests can fake it. The binding needs no zone settings, only
 * the `images` entry in `wrangler.jsonc`.
 */
export interface ImagesLike {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: Readonly<{ width: number; fit: 'scale-down' }>): {
      output(
        options: Readonly<{ format: 'image/webp'; quality: number }>,
      ): Promise<{ response(): Response }>;
    };
  };
}

/** Whether a value is usable as the Images binding: it can take an image as input. */
export function isImagesBinding(value: unknown): value is ImagesLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'input') === 'function'
  );
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

/** The outcome of `work`, or undefined if it threw: a failed step is an answer here, not a crash. */
async function attempt<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch {
    return undefined;
  }
}

/** A refusal to send a photo, with the status to answer and a sentence saying why. */
function refusal(
  status: Extract<CoverResult, { ok: false }>['status'],
  reason: string,
): CoverResult {
  return { ok: false, status, reason };
}

/**
 * The photo scaled down to `width` and encoded as WebP, or undefined when
 * scaling fails or would not make it any smaller. The original is then sent
 * as it is, so a photo is never lost to an optimisation.
 */
async function scaledCopy(
  images: ImagesLike,
  bytes: ArrayBuffer,
  width: number,
): Promise<ArrayBuffer | undefined> {
  const scaled = await attempt(async () => {
    const output = await images
      .input(new Blob([bytes]).stream())
      .transform({ width: snapWidth(width), fit: 'scale-down' })
      .output({ format: 'image/webp', quality: 75 });
    return output.response().arrayBuffer();
  });
  // Only keep the result if it is really smaller than the original.
  return scaled && scaled.byteLength > 0 && scaled.byteLength < bytes.byteLength
    ? scaled
    : undefined;
}

/** How long the photo's site gets to answer and send the photo, in all. */
const FETCH_TIMEOUT_MS = 8000;

/** What we ask the photo's site for, best format first. */
const ACCEPT_IMAGES = 'image/avif,image/webp,image/apng,image/*;q=0.8';

/** Whether a media type is a raster image: any image except SVG, which can carry script. */
function isRasterImage(mediaType: string): boolean {
  return mediaType.startsWith('image/') && !mediaType.startsWith('image/svg');
}

/** The refusal that answers a fetch that gave no photo. */
function refusalFor(failure: FetchFailure): CoverResult {
  switch (failure.reason) {
    case 'blocked':
      return refusal(400, 'Not a fetchable image address.');
    case 'type':
      return refusal(415, 'That address is not a photo.');
    case 'too-large':
      return refusal(413, 'The photo is too large.');
    case 'status':
      return failure.status === 404 || failure.status === 410
        ? refusal(404, 'The image is gone.')
        : refusal(502, 'The image site refused.');
    case 'redirects':
    case 'timeout':
    case 'unreachable':
      return refusal(502, 'The image site did not answer.');
  }
}

/**
 * Fetch one cover photo for the proxy. Only real, reasonably small raster images
 * are accepted: never SVG (which can carry script), never an HTML page. The
 * fetch is the shared safe one (`http/safe-fetch.ts`): the photo is read with a
 * hard byte limit however its site behaves, and a redirect is followed only to
 * another public address. Where the Images binding is available the photo is
 * scaled down to `width` and sent as WebP, typically a tenth of the original's
 * weight; if scaling fails the original is passed through, so a photo is never
 * lost to an optimisation.
 */
export async function fetchCover(
  url: string,
  width: number,
  deps: Readonly<{ fetcher?: CoverFetch; images?: ImagesLike }> = {},
): Promise<CoverResult> {
  const fetched = await fetchCapped(url, {
    maxBytes: MAX_COVER_BYTES,
    timeoutMs: FETCH_TIMEOUT_MS,
    accept: ACCEPT_IMAGES,
    acceptsType: isRasterImage,
    // Cloudflare-only: keep the original at the edge, ignored elsewhere.
    edgeCache: { cacheEverything: true, cacheTtl: KEEP_SECONDS },
    fetcher: deps.fetcher,
  });
  if (!fetched.ok) {
    return refusalFor(fetched);
  }
  const { bytes, type } = fetched;
  const scaled =
    deps.images && SCALABLE.test(type) && bytes.byteLength > SCALE_FROM_BYTES
      ? await scaledCopy(deps.images, bytes, width)
      : undefined;
  return {
    ok: true,
    response: new Response(scaled ?? bytes, {
      headers: coverHeaders(scaled ? 'image/webp' : type),
    }),
  };
}
