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

import { bytesToBase64 } from '../util/base64';
import { replacingHeaders } from './headers';

/** A fresh, unguessable nonce: 16 random bytes, base64. */
export function newNonce(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** Which kind of page a policy is for: an ordinary one, or the approval screen. */
export type CspSurface = 'site' | 'approval';

/**
 * The policy for one response, carrying that response's nonce.
 *
 * The approval screen (`approval`) differs in two ways. It may not be framed by
 * anyone, this site included (`frame-ancestors 'none'`). And it names no
 * `form-action`: its form posts to our own consent endpoint, which answers with a
 * redirect to the *client's* address (a web page, a localhost port, an app's own
 * scheme). Browsers check a form's redirects against `form-action`, so listing
 * `'self'` there makes them refuse to send the person back to the app they just
 * approved. Where the form is allowed to post is not what protects the page
 * (the consent endpoint is protected by its own same-origin and CSRF checks),
 * so the directive is left out rather than made so wide it means nothing.
 */
export function buildCsp(nonce: string, surface: CspSurface = 'site'): string {
  const approval = surface === 'approval';
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
    ...(approval ? [] : ["form-action 'self'"]),
    `frame-ancestors '${approval ? 'none' : 'self'}'`,
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
  return replacingHeaders(incoming, {
    'content-security-policy': csp,
    'x-nonce': nonce,
  });
}
