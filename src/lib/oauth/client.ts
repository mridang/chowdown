/**
 * @packageDocumentation
 *
 * OAuth clients: the assistants that ask a user for access. A client is known
 * in one of two ways:
 *
 *  - **Client ID Metadata Document** (preferred by the MCP spec): the
 *    `client_id` is an HTTPS URL, and the JSON at that URL describes the client.
 *    Nothing to register; we fetch and validate it.
 *  - **Dynamic registration** (RFC 7591, deprecated but still common): the
 *    client posts its details to `/oauth/register` and gets an id back.
 *
 * Only public clients (no client secret, PKCE required) are supported.
 */

import { sanitiseDisplayName } from './display';
import { isAcceptableRedirectUri } from './redirect-uri';
import { bytesToBase64Url } from '../util/base64';
import { parseUrl } from '../util/url';

/** A client as the authorization server uses it. */
export interface OAuthClient {
  readonly clientId: string;
  readonly name: string;
  readonly redirectUris: readonly string[];
  /** How the client became known: `dcr` registered itself, `cimd` published a metadata document. */
  readonly kind: 'dcr' | 'cimd';
}

/** Largest metadata document we will read, in bytes (CIMD draft §6.6 asks implementations to limit the size). */
export const MAX_DOCUMENT_BYTES = 10_000;

/** How long to wait for a client's metadata document. */
const FETCH_TIMEOUT_MS = 5000;

/** How long a fetched document is trusted when the server says nothing about caching (one hour). */
export const DEFAULT_DOCUMENT_TTL_SECONDS = 60 * 60;

/** The shortest time a fetched document is kept, however short-lived the server says it is (five minutes). */
export const MIN_DOCUMENT_TTL_SECONDS = 5 * 60;

/** The longest time a fetched document is kept, however long-lived the server says it is (one day). */
export const MAX_DOCUMENT_TTL_SECONDS = 24 * 60 * 60;

/** Whether a `client_id` is a metadata-document URL rather than a plain id. */
export function isMetadataDocumentUrl(clientId: string): boolean {
  const url = parseUrl(clientId);
  return (
    url !== undefined &&
    url.protocol === 'https:' &&
    url.pathname.length > 1 &&
    // CIMD draft §3: the URL SHOULD NOT have a query string.
    !url.href.includes('?') &&
    !url.hash &&
    !url.username &&
    !url.password &&
    url.hostname.includes('.') &&
    // A bare IP address is never a client's public home.
    !/^[\d.]+$/.test(url.hostname) &&
    !url.hostname.startsWith('[') &&
    // Dot segments, an upper-case host or a default port would make the URL
    // we fetch differ from the client_id the client presented.
    url.href === clientId
  );
}

/**
 * A client's display name, cleaned for showing to a person (see
 * {@link sanitiseDisplayName}): invisible and direction-changing characters
 * removed, whitespace collapsed, capped, and `fallback` when nothing is left.
 */
function cleanName(name: unknown, fallback: string): string {
  return sanitiseDisplayName(name, fallback);
}

/** Whether a value is a JSON object (or array) whose members can be looked up by name. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** Whether every member of a list is a redirect address we would accept. */
function isRedirectList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 20 &&
    value.every((u) => typeof u === 'string' && isAcceptableRedirectUri(u))
  );
}

/** The redirect addresses to use: 1 to 20 acceptable ones, or undefined. */
function redirectList(value: unknown): readonly string[] | undefined {
  return isRedirectList(value) ? value : undefined;
}

/**
 * What looking a client up can answer besides "here it is" and "unknown": "ask
 * again later". The lookup would have meant fetching the client's metadata
 * document, and too many fetches have happened lately (see `limits.ts`).
 */
export interface ClientBusy {
  readonly busy: true;
  /** Seconds to wait before asking again. */
  readonly retryAfterSeconds: number;
}

/** Whether a client lookup answered "ask again later". */
export function isClientBusy(
  lookup: OAuthClient | ClientBusy | undefined,
): lookup is ClientBusy {
  return lookup !== undefined && 'busy' in lookup;
}

/** How long a cached copy of a metadata document may still be used when a fresh one cannot be fetched (seven days). */
export const MAX_STALE_DOCUMENT_SECONDS = 7 * 24 * 60 * 60;

/** The timestamps that say how current a cached metadata document is. */
export interface CachedDocument {
  /** When it was fetched (ISO-8601), or null if the client was not fetched. */
  readonly fetchedAt: string | null;
  /** Until when it may be reused (ISO-8601); null for copies stored before expiry was recorded. */
  readonly expiresAt: string | null;
}

/** Whether a cached document may be used as it is, without fetching it again, at `nowMs` (milliseconds). */
export function isDocumentFresh(
  cached: Readonly<CachedDocument>,
  nowMs: number,
): boolean {
  if (cached.fetchedAt === null) {
    return false;
  }
  const until = cached.expiresAt
    ? Date.parse(cached.expiresAt)
    : Date.parse(cached.fetchedAt) + DEFAULT_DOCUMENT_TTL_SECONDS * 1000;
  return nowMs < until;
}

/**
 * Whether a cached document is recent enough to fall back on when fetching a
 * new one fails. Past {@link MAX_STALE_DOCUMENT_SECONDS} the client is treated
 * as unknown rather than trusted on very old data (CIMD draft §4.3: abort when
 * discovery fails).
 */
export function isDocumentUsable(
  cached: Readonly<CachedDocument>,
  nowMs: number,
): boolean {
  return (
    cached.fetchedAt !== null &&
    nowMs - Date.parse(cached.fetchedAt) < MAX_STALE_DOCUMENT_SECONDS * 1000
  );
}

/** The result of validating client metadata. */
export type ClientParse =
  | { readonly ok: true; readonly client: OAuthClient }
  | {
      readonly ok: false;
      readonly error: string;
      readonly description: string;
    };

/**
 * Validate a fetched Client ID Metadata Document. The `client_id` inside must
 * equal the URL it was fetched from, or anyone could claim to be anyone.
 */
export function parseClientMetadataDocument(
  document: unknown,
  url: string,
): ClientParse {
  const bad = (description: string): ClientParse => ({
    ok: false,
    error: 'invalid_client',
    description,
  });
  if (!isRecord(document)) {
    return bad('The client metadata document is not a JSON object.');
  }
  const doc = document;
  if (doc['client_id'] !== url) {
    return bad('The document client_id does not match the URL it came from.');
  }
  const redirectUris = redirectList(doc['redirect_uris']);
  if (!redirectUris) {
    return bad('The document has no valid redirect_uris.');
  }
  const method = doc['token_endpoint_auth_method'];
  if (method !== undefined && method !== 'none') {
    return bad(
      'Only public clients (token_endpoint_auth_method "none") are supported.',
    );
  }
  return {
    ok: true,
    client: {
      clientId: url,
      name: cleanName(doc['client_name'], new URL(url).hostname),
      redirectUris,
      kind: 'cimd',
    },
  };
}

/** A fetched and validated metadata document, with how long it may be kept. */
export type ClientFetch =
  | {
      readonly ok: true;
      readonly client: OAuthClient;
      /** How long the document may be reused before fetching it again, in seconds. */
      readonly ttlSeconds: number;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly description: string;
    };

/**
 * How long a fetched document may be reused, from its `Cache-Control` header:
 * `max-age`, kept within five minutes and a day. Without the header, or with
 * `no-store`/`no-cache`, the shortest time applies (the document is still needed
 * for the few minutes a sign-in takes, so it is never dropped at once).
 */
export function documentTtlSeconds(cacheControl: string | null): number {
  if (cacheControl === null) {
    return DEFAULT_DOCUMENT_TTL_SECONDS;
  }
  const directives = cacheControl
    .toLowerCase()
    .split(',')
    .map((directive) => directive.trim());
  if (directives.some((d) => d === 'no-store' || d === 'no-cache')) {
    return MIN_DOCUMENT_TTL_SECONDS;
  }
  const maxAge = directives
    .map((d) => /^max-age=(\d+)$/.exec(d)?.[1])
    .find((value) => value !== undefined);
  return maxAge === undefined
    ? DEFAULT_DOCUMENT_TTL_SECONDS
    : Math.min(
        MAX_DOCUMENT_TTL_SECONDS,
        Math.max(MIN_DOCUMENT_TTL_SECONDS, Number(maxAge)),
      );
}

/** Read chunks until the stream ends, or give up (undefined) once more than `remaining` bytes have arrived. */
async function drain(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  remaining: number,
  chunks: readonly Uint8Array[] = [],
): Promise<readonly Uint8Array[] | undefined> {
  const { done, value } = await reader.read();
  if (done) {
    return chunks;
  }
  if (value.byteLength > remaining) {
    await reader.cancel();
    return undefined;
  }
  return drain(reader, remaining - value.byteLength, [...chunks, value]);
}

/**
 * The body of a response as text, read as a stream so that a hostile server
 * can never make us hold more than `maxBytes`: a declared `Content-Length`
 * over the cap is refused before reading, and an undeclared (or lying) body is
 * cut off the moment it passes the cap. Undefined means "too large".
 */
export async function readCappedText(
  response: Response,
  maxBytes: number,
): Promise<string | undefined> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    return undefined;
  }
  if (!response.body) {
    return '';
  }
  const chunks = await drain(response.body.getReader(), maxBytes);
  // One decoder carried across the chunks, so a character split between two of
  // them still decodes; only the last chunk flushes it.
  const decoder = new TextDecoder();
  return chunks
    ?.map((chunk, at) =>
      decoder.decode(chunk, { stream: at < chunks.length - 1 }),
    )
    .join('');
}

/**
 * Fetch and validate a client's metadata document. Never follows redirects, caps
 * the size (streamed, so a huge body is never buffered) and time, and (on
 * Workers) can only reach public hosts, so a hostile `client_id` can't be used
 * to probe internal services. The result says how long the document may be
 * reused, from its cache headers.
 */
export async function fetchClientMetadata(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientFetch> {
  const bad = (description: string): ClientFetch => ({
    ok: false,
    error: 'invalid_client',
    description,
  });
  if (!isMetadataDocumentUrl(url)) {
    return bad('The client_id is not a usable metadata document URL.');
  }
  const response = await fetchImpl(url, {
    redirect: 'manual',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch(() => undefined);
  if (!response) {
    return bad('The client metadata document could not be fetched.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    return bad(
      `The client metadata document returned HTTP ${response.status}.`,
    );
  }
  const text = await readCappedText(response, MAX_DOCUMENT_BYTES).catch(
    () => undefined,
  );
  if (text === undefined) {
    return bad('The client metadata document is too large or unreadable.');
  }
  const json = parseJson(text);
  const parsed = json.ok
    ? parseClientMetadataDocument(json.value, url)
    : bad('The client metadata document is not valid JSON.');
  return parsed.ok
    ? {
        ok: true,
        client: parsed.client,
        ttlSeconds: documentTtlSeconds(response.headers.get('cache-control')),
      }
    : parsed;
}

/** JSON text parsed without throwing: the value, or a note that it wasn't JSON. */
function parseJson(
  text: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** The outcome of a dynamic registration request. */
export type Registration =
  | { readonly ok: true; readonly client: OAuthClient }
  | {
      readonly ok: false;
      readonly error: 'invalid_redirect_uri' | 'invalid_client_metadata';
      readonly description: string;
    };

/** Registration bodies are tiny; anything bigger is refused unread. */
export const MAX_REGISTRATION_BYTES = 8_000;

/** Read the text of an RFC 7591 registration request: size, then JSON, then the rules of {@link parseRegistration}. */
export function parseRegistrationText(text: string): Registration {
  if (text.length > MAX_REGISTRATION_BYTES) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'The request is too large.',
    };
  }
  const body = parseJson(text);
  return body.ok
    ? parseRegistration(body.value)
    : {
        ok: false,
        error: 'invalid_client_metadata',
        description: 'The request is not valid JSON.',
      };
}

/** The RFC 7591 answer for a client that has just registered (`issuedAt` in Unix seconds). */
export function registrationResponse(
  client: Readonly<OAuthClient>,
  issuedAt: number,
): Readonly<Record<string, unknown>> {
  return {
    client_id: client.clientId,
    client_name: client.name,
    redirect_uris: client.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    client_id_issued_at: issuedAt,
  };
}

/** Validate an RFC 7591 registration request and mint a client id. */
export function parseRegistration(body: unknown): Registration {
  if (!isRecord(body)) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'The request body must be a JSON object.',
    };
  }
  const data = body;
  const redirectUris = redirectList(data['redirect_uris']);
  if (!redirectUris) {
    return {
      ok: false,
      error: 'invalid_redirect_uri',
      description:
        'redirect_uris must list 1–20 https URIs, loopback http URIs (localhost, 127.0.0.1 or [::1]) or reverse-domain app-scheme URIs.',
    };
  }
  const method = data['token_endpoint_auth_method'];
  if (method !== undefined && method !== 'none') {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description:
        'Only public clients (token_endpoint_auth_method "none") are supported.',
    };
  }
  const grants = data['grant_types'];
  if (
    grants !== undefined &&
    (!Array.isArray(grants) ||
      !grants.every((g) => g === 'authorization_code' || g === 'refresh_token'))
  ) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description:
        'Only the authorization_code and refresh_token grants are supported.',
    };
  }
  const responseTypes = data['response_types'];
  if (
    responseTypes !== undefined &&
    !(
      Array.isArray(responseTypes) &&
      responseTypes.length > 0 &&
      responseTypes.every((type) => type === 'code')
    )
  ) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'Only the code response type is supported.',
    };
  }
  const id = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  return {
    ok: true,
    client: {
      clientId: `dcr_${id}`,
      name: cleanName(data['client_name'], 'Unnamed client'),
      redirectUris,
      kind: 'dcr',
    },
  };
}
