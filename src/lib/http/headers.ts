/**
 * @packageDocumentation
 *
 * The response headers every page and API answer carries: browser security
 * settings and caching rules. They are applied in one place, the Worker entry
 * (`src/worker.ts`), so a new route can't forget them. Static files bypass the
 * Worker, so `public/_headers` repeats the same security headers for them (a
 * test keeps the two in step).
 */

/** Security headers for every response. */
export const SECURITY_HEADERS: Record<string, string> = {
  // Never let a browser guess a different content type for a response.
  'X-Content-Type-Options': 'nosniff',
  // Send other sites only our origin, and nothing at all on a downgrade.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Talk to HTTPS only, for two years, on this host and its subdomains.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Nothing here needs the camera, microphone, location or payments.
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  // Only this site may frame it (the sign-in approval page forbids even that),
  // and keep forms, <base> and plugins on a short leash.
  'Content-Security-Policy':
    "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Frame-Options': 'SAMEORIGIN',
  // Keep other windows from reaching into this one.
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** The pages search engines may index. Everything else is private. */
export const PUBLIC_PAGES: ReadonlySet<string> = new Set(['/', '/privacy']);

/**
 * Which other sites may load a file as a picture, script or style. Our pages
 * and data are for this site only (`same-site`); the few files other sites
 * embed or fetch on purpose (the social card, the icons, the manifest and the
 * plain-text files at the root) are open to all.
 */
const OPEN_FILES =
  /^\/(opengraph-image\.png|twitter-image\.png|icon\.svg|apple-icon\.png|manifest\.webmanifest|robots\.txt|sitemap\.xml|llms\.txt|\.well-known\/.*|icons\/.*)$/;

/** The `Cross-Origin-Resource-Policy` for a path. */
export function resourcePolicyFor(pathname: string): string {
  return OPEN_FILES.test(pathname) ? 'cross-origin' : 'same-site';
}

/** Cache rules for the few responses that want something other than the default. */
function cacheControlFor(pathname: string, response: Response): string | null {
  if (
    pathname === '/manifest.webmanifest' ||
    pathname === '/icon.svg' ||
    pathname === '/apple-icon.png'
  ) {
    // Rarely changes, and a stale copy is harmless.
    return 'public, max-age=86400, stale-while-revalidate=604800';
  }
  const type = response.headers.get('content-type') ?? '';
  const isPage = type.startsWith('text/html');
  const ours = !pathname.startsWith('/api/') && !pathname.startsWith('/oauth/');
  if (isPage && ours) {
    // Pages are personal, so a shared cache must not keep them; "no-cache"
    // (rather than Next's "no-store") still lets the back button restore a page
    // instantly while the browser checks for a newer one.
    return 'private, no-cache';
  }
  return null;
}

/**
 * The response with the site's security headers added and, where it has one, a
 * better cache rule. Responses that set their own security headers (the
 * sign-in approval page) keep them.
 */
export function applyResponseHeaders(
  request: Request,
  response: Response,
): Response {
  // A redirect or an upgrade has no headers we may change, and no body to protect.
  if (response.status === 101 || response.webSocket) {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  const { pathname } = new URL(request.url);
  if (!headers.has('Cross-Origin-Resource-Policy')) {
    headers.set('Cross-Origin-Resource-Policy', resourcePolicyFor(pathname));
  }
  if (
    !PUBLIC_PAGES.has(pathname) &&
    !OPEN_FILES.test(pathname) &&
    !headers.has('X-Robots-Tag')
  ) {
    // Whatever the page itself says, tell crawlers not to index or follow it.
    // (The files other sites are meant to fetch, such as the sitemap and
    // robots.txt, are left alone: marking them noindex would only confuse.)
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  const cache = cacheControlFor(pathname, response);
  if (cache) {
    headers.set('Cache-Control', cache);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
