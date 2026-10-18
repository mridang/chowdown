/**
 * @packageDocumentation
 *
 * Cloudflare compresses what it serves on the fly, at a quick, light setting:
 * the framework script that gzips to 72 KB comes out of brotli at the edge at
 * 72 KB too, where brotli at its strongest makes it 62 KB. Scripts and styles
 * are built once and cached for a year, so it is worth squeezing them as hard
 * as brotli can at build time (`scripts/optimize-assets.mjs` writes a `.br` copy
 * of each) and handing browsers that accept brotli that copy, with the
 * `Content-Encoding` header already set so Cloudflare passes it through
 * untouched. Everyone else gets the normal file.
 */

/** The built scripts and styles that have a pre-compressed copy. */
const COMPRESSED_ASSET = /^\/_next\/static\/.+\.(js|css)$/;

/**
 * Whether the browser's `Accept-Encoding` lists brotli. On Cloudflare the header
 * the Worker sees has been normalised, so the browser's own is read from
 * `request.cf.clientAcceptEncoding` when it is there.
 */
function acceptsBrotli(request: Request): boolean {
  const original = (request as { cf?: { clientAcceptEncoding?: string } }).cf
    ?.clientAcceptEncoding;
  const accepted = original ?? request.headers.get('accept-encoding') ?? '';
  return accepted.split(',').some((part) => {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    // "br;q=0" means "no brotli".
    return (
      name === 'br' && !params.some((p) => /^\s*q\s*=\s*0(\.0*)?\s*$/.test(p))
    );
  });
}

/** Whether this request is for a built script or style. */
export function isBuiltAsset(request: Request): boolean {
  return COMPRESSED_ASSET.test(new URL(request.url).pathname);
}

/**
 * The address of the brotli copy to use for a request, or null when the request
 * isn't for a built script or style or the browser can't take brotli.
 */
export function precompressedUrl(request: Request): URL | null {
  if (
    (request.method !== 'GET' && request.method !== 'HEAD') ||
    !isBuiltAsset(request) ||
    !acceptsBrotli(request)
  ) {
    return null;
  }
  const url = new URL(request.url);
  url.pathname = `${url.pathname}.br`;
  url.search = '';
  return url;
}

/** The media type for a script or style address. */
function typeOf(pathname: string): string {
  return pathname.endsWith('.css')
    ? 'text/css; charset=utf-8'
    : 'text/javascript; charset=utf-8';
}

/**
 * The response to send for a built asset, given its `.br` file from the assets
 * store: the same bytes, labelled with their real type and encoding, and cached
 * for a year (the file name changes whenever its contents do). Null if the copy
 * wasn't found, so the caller falls back to the plain file.
 */
export function brotliResponse(
  request: Request,
  copy: Response,
): Response | null {
  if (!copy.ok) {
    return null;
  }
  return new Response(request.method === 'HEAD' ? null : copy.body, {
    status: 200,
    // The bytes are already brotli: without this the Workers runtime would
    // compress them a second time because of the Content-Encoding header.
    encodeBody: 'manual',
    headers: {
      'Content-Type': typeOf(new URL(request.url).pathname),
      'Content-Encoding': 'br',
      'Cache-Control': 'public, max-age=31536000, immutable, no-transform',
      Vary: 'Accept-Encoding',
      'Content-Length': copy.headers.get('content-length') ?? '',
    },
  } as ResponseInit);
}
