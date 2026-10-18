/**
 * @packageDocumentation
 *
 * The Content Security Policy: the browser's own list of what a page may load
 * and run. It is what stops a script injected into a page (through some future
 * bug) from running at all.
 *
 * Scripts are allowed only if they carry this response's one-time number (the
 * nonce), which Next.js puts on the scripts and styles it writes when it finds
 * the nonce in the policy on the incoming request. `strict-dynamic` then lets
 * those scripts load the others they need. Nothing else may run, and nothing
 * may be framed, embedded or sent anywhere but this site.
 */

/** A fresh, unguessable nonce: 16 random bytes, base64. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

/**
 * The policy for one response, carrying that response's nonce. `framing` says
 * who may put the page in a frame: this site (the default) or no one.
 */
export function buildCsp(
  nonce: string,
  framing: 'self' | 'none' = 'self',
): string {
  return [
    // Deny anything not named below; every kind of load the site needs is listed.
    "default-src 'none'",
    // `'self'` only matters to browsers too old to know strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    // The signed-in person's Google photo is the only picture from elsewhere;
    // recipe photos come through our own address.
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors '${framing}'`,
    'upgrade-insecure-requests',
  ].join('; ');
}

/** The nonce in a policy, if it carries one. */
export function nonceOf(csp: string): string | undefined {
  return /'nonce-([^']+)'/.exec(csp)?.[1];
}

/**
 * The headers to forward to the app: the caller's own, with the policy and the
 * nonce set to ours. `set`, not append: a policy or nonce header sent by the
 * caller must be replaced, or Next.js could read the caller's nonce instead of
 * ours and render a page (that may then be cached) whose scripts our policy
 * refuses.
 */
export function forwardedHeaders(
  incoming: Headers,
  csp: string,
  nonce: string,
): Headers {
  const headers = new Headers(incoming);
  headers.set('content-security-policy', csp);
  headers.set('x-nonce', nonce);
  return headers;
}
