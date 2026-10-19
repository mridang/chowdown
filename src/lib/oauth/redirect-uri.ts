/**
 * @packageDocumentation
 *
 * Redirect URI rules. The authorization code is sent to the redirect URI, so
 * this is the check that stops a code going to an attacker: a client may only
 * use URIs it registered, compared exactly (loopback addresses excepted).
 */

import { parseUrl } from '../util/url';

/** Schemes that can run script or read files; never a valid redirect target. */
const FORBIDDEN_SCHEMES = new Set([
  'javascript:',
  'data:',
  'file:',
  'vbscript:',
  'blob:',
  'about:',
  'ftp:',
]);

/** Hosts that mean "this machine", where native apps pick a free port. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether a client may register this redirect URI: https anywhere, plain http
 * only to loopback, and private-use schemes (a desktop app's own `app://`).
 * Fragments are never allowed.
 */
export function isAcceptableRedirectUri(uri: string): boolean {
  const url = parseUrl(uri);
  if (!url || url.hash || url.username || url.password) {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  if (url.protocol === 'http:') {
    return LOOPBACK_HOSTS.has(url.hostname);
  }
  return !FORBIDDEN_SCHEMES.has(url.protocol);
}

/**
 * Whether the redirect URI in a request is one the client registered. Exact
 * match, except that for a loopback `http` URI the port may differ, because a
 * native app can't know its port in advance (RFC 8252 §7.3).
 */
export function redirectUriMatches(
  requested: string,
  registered: readonly string[],
): boolean {
  if (registered.includes(requested)) {
    return true;
  }
  const want = parseUrl(requested);
  if (
    !want ||
    want.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(want.hostname)
  ) {
    return false;
  }
  return registered.some((r) => {
    const have = parseUrl(r);
    return (
      have !== undefined &&
      have.protocol === 'http:' &&
      have.hostname === want.hostname &&
      have.pathname === want.pathname &&
      have.search === want.search
    );
  });
}
