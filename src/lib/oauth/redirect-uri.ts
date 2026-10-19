/**
 * @packageDocumentation
 *
 * Redirect URI rules. The authorization code is sent to the redirect URI, so
 * this is the check that stops a code going to an attacker: a client may only
 * use URIs it registered, compared exactly (loopback addresses excepted), and
 * the URIs themselves must be of a kind that can be trusted to reach the app
 * (see {@link isAcceptableRedirectUri}).
 */

import { parseUrl } from '../util/url';

/** Schemes that can run script or read files; never a valid redirect target, dotted or not. */
const FORBIDDEN_SCHEMES: ReadonlySet<string> = new Set([
  'javascript:',
  'data:',
  'file:',
  'vbscript:',
  'blob:',
  'about:',
  'ftp:',
]);

/** Hosts that mean "this machine", where native apps pick a free port. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

/**
 * Well-known desktop assistants whose private-use schemes are one short word
 * rather than a reverse domain name (RFC 8252 §7.1 asks for the latter, but
 * these clients shipped before the MCP authorization spec and still use the
 * short form). Without this list Cursor (`cursor://anysphere.cursor-retrieval/…`),
 * VS Code (`vscode://…`) and Claude Desktop (`claude://…`) could not connect.
 * Add a scheme here only for a real client that cannot use a dotted one.
 */
const KNOWN_APP_SCHEMES: ReadonlySet<string> = new Set([
  'claude:',
  'cursor:',
  'vscode:',
  'vscode-insiders:',
  'vscodium:',
  'windsurf:',
  'zed:',
]);

/** How a redirect address reaches the client: over the web, to this computer, or to an installed app. */
export type RedirectKind = 'web' | 'loopback' | 'app';

/** Whether a URL is plain http to this machine. */
function isLoopbackHttp(url: Readonly<URL>): boolean {
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Whether a private-use scheme is acceptable: a reverse-domain name (it contains
 * a dot, as RFC 8252 §7.1 recommends, e.g. `com.example.app:`) or one of the
 * {@link KNOWN_APP_SCHEMES}. Anything on the forbidden list is refused first.
 */
function isAcceptableAppScheme(protocol: string): boolean {
  return (
    !FORBIDDEN_SCHEMES.has(protocol) &&
    (KNOWN_APP_SCHEMES.has(protocol) || protocol.slice(0, -1).includes('.'))
  );
}

/**
 * Whether a client may register this redirect URI. The MCP authorization spec
 * says redirect URIs MUST be `localhost` or HTTPS, and RFC 8252 lets native apps
 * use private-use schemes, so the rule is:
 *
 *  - `https:` anywhere;
 *  - `http:` only to a loopback host (`localhost`, `127.0.0.1`, `[::1]`), any port;
 *  - a private-use scheme only if it is a reverse domain name (contains a dot)
 *    or one of a few known assistants' own schemes (see {@link KNOWN_APP_SCHEMES});
 *  - nothing else (`http:` to a real host, `ws:`, `mailto:`, `javascript:`, …).
 *
 * Fragments and embedded credentials are never allowed.
 */
export function isAcceptableRedirectUri(uri: string): boolean {
  const url = parseUrl(uri);
  if (!url || url.hash || url.username || url.password) {
    return false;
  }
  if (url.protocol === 'https:') {
    return url.hostname !== '';
  }
  if (url.protocol === 'http:') {
    return isLoopbackHttp(url);
  }
  return isAcceptableAppScheme(url.protocol);
}

/**
 * How a redirect address reaches the client, for the approval screen:
 * `loopback` means a web server on the user's own computer, `app` means an
 * installed app's own scheme, `web` is everything else.
 */
export function redirectKind(uri: string): RedirectKind {
  const url = parseUrl(uri);
  if (url && isLoopbackHttp(url)) {
    return 'loopback';
  }
  return url && url.protocol !== 'https:' && url.protocol !== 'http:'
    ? 'app'
    : 'web';
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
