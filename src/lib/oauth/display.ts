/**
 * @packageDocumentation
 *
 * How an OAuth client is described to the person who has to approve it. The
 * approval screen is the only defence against a look-alike app asking for a
 * token that can change their recipes, so everything a client says about itself
 * is cleaned before it is shown, and everything we can know about it for sure
 * (the domain its `client_id` lives on, where approving sends them) is shown
 * next to what it merely claims (its name).
 *
 * Nothing here renders HTML: the functions return plain text, and React escapes
 * it. They are pure so the rules can be tested without a page.
 */

import { redirectKind, type RedirectKind } from './redirect-uri';
import type { OAuthClient } from './client';
import { SCOPE_READ, SCOPE_WRITE } from './scopes';
import { parseUrl } from '../util/url';

/** The longest client name we show. */
export const MAX_DISPLAY_NAME_LENGTH = 100;

/** What the screen calls a client that gave no usable name. */
export const NEUTRAL_CLIENT_NAME = 'An unnamed app';

/**
 * Characters with no business in a name: controls (`Cc`), formatting such as
 * bidi overrides and isolates, zero-width spaces and joiners, the BOM and tag
 * characters (`Cf`), surrogates and private-use or unassigned code points. They
 * are invisible or reorder the text around them, which is how a name is made to
 * read as something it is not.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/gu;

/**
 * Clean a name a client gave for itself so it is safe to show: Unicode
 * normalised (NFKC, so full-width and ligature look-alikes become the plain
 * letters), invisible and direction-changing characters removed, runs of
 * whitespace (line breaks included) collapsed to one space, trimmed, and cut to
 * `maxLength` characters (whole characters, never half of an emoji). Returns
 * `fallback` when nothing is left or the input was not text.
 */
export function sanitiseDisplayName(
  raw: unknown,
  fallback: string,
  maxLength: number = MAX_DISPLAY_NAME_LENGTH,
): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const cleaned = raw
    .normalize('NFKC')
    // Line and paragraph separators and tabs are whitespace, not invisible;
    // turn them into spaces before the invisible characters are dropped.
    .replace(/\s+/gu, ' ')
    .replace(INVISIBLE, '')
    .trim();
  const capped = [...cleaned].slice(0, maxLength).join('').trim();
  return capped || fallback;
}

/**
 * What we know about who a client is. A `cimd` client is identified by the
 * domain that hosts its metadata document (that much is verified: only the
 * owner of the domain can publish there). A `dcr` client registered itself
 * anonymously, so nothing about it is verified.
 */
export type ClientIdentity =
  | { readonly kind: 'domain'; readonly domain: string }
  | { readonly kind: 'unverified' };

/** The identity line for a client: the host of its `client_id` URL, or "unverified". */
export function clientIdentity(
  client: Readonly<Pick<OAuthClient, 'clientId' | 'kind'>>,
): ClientIdentity {
  // A `cimd` client's id was already checked to be an https URL when its
  // document was fetched, so only the host needs reading out.
  const url = client.kind === 'cimd' ? parseUrl(client.clientId) : undefined;
  return url ? { kind: 'domain', domain: url.host } : { kind: 'unverified' };
}

/** What approving does to the browser: where it goes and what to be careful of. */
export interface RedirectDescription {
  /** The whole address the person is sent back to, exactly as it will be used. */
  readonly address: string;
  /** How it reaches the client. */
  readonly kind: RedirectKind;
  /** The host (or, for an app scheme, the scheme) in short form. */
  readonly short: string;
  /** A sentence of warning for the person, or undefined when the address is ordinary. */
  readonly warning: string | undefined;
}

/** The warning shown for an address on the person's own computer (the MCP spec's localhost SHOULD). */
export const LOOPBACK_WARNING =
  'This app runs on your own computer. Anything running on your computer could answer this request, so approve only if you just started this connection yourself.';

/** The note shown for an address that opens an installed app. */
export const APP_SCHEME_WARNING =
  'This opens an app installed on your device. Approve only if you just started this connection from that app.';

/**
 * Describe the address approving will send the person to: the full text, how it
 * reaches the client, a short form for headlines and a warning where the kind
 * of address deserves one.
 */
export function describeRedirect(redirectUri: string): RedirectDescription {
  const kind = redirectKind(redirectUri);
  const url = parseUrl(redirectUri);
  const short = url ? url.host || url.protocol : redirectUri;
  const warnings: Readonly<Record<RedirectKind, string | undefined>> = {
    web: undefined,
    loopback: LOOPBACK_WARNING,
    app: APP_SCHEME_WARNING,
  };
  return { address: redirectUri, kind, short, warning: warnings[kind] };
}

/** What each scope lets the app do, in plain words. */
const SCOPE_TEXT: Readonly<Record<string, string>> = {
  [SCOPE_READ]: 'See your recipes, search them and find similar ones',
  [SCOPE_WRITE]:
    'Add, edit, tag, favourite and annotate recipes, and change your settings',
};

/** The plain-words description of each requested scope; an unknown scope is shown as it is. */
export function describeScopes(scopes: readonly string[]): readonly string[] {
  return scopes.map((scope) => SCOPE_TEXT[scope] ?? scope);
}
