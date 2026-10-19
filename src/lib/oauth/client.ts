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

/** Largest metadata document we will read. */
const MAX_DOCUMENT_BYTES = 10_000;

/** How long to wait for a client's metadata document. */
const FETCH_TIMEOUT_MS = 5000;

/** The longest client name we show on the consent page. */
const MAX_NAME_LENGTH = 100;

/** Whether a `client_id` is a metadata-document URL rather than a plain id. */
export function isMetadataDocumentUrl(clientId: string): boolean {
  const url = parseUrl(clientId);
  return (
    url !== undefined &&
    url.protocol === 'https:' &&
    url.pathname.length > 1 &&
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

/** A client's display name: trimmed, capped, with a fallback when it gave none. */
function cleanName(name: unknown, fallback: string): string {
  const text = typeof name === 'string' ? name.trim() : '';
  return (text || fallback).slice(0, MAX_NAME_LENGTH);
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

/**
 * Fetch and validate a client's metadata document. Never follows redirects, caps
 * the size and time, and (on Workers) can only reach public hosts, so a hostile
 * `client_id` can't be used to probe internal services.
 */
export async function fetchClientMetadata(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientParse> {
  const bad = (description: string): ClientParse => ({
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
    return bad(
      `The client metadata document returned HTTP ${response.status}.`,
    );
  }
  const text = await response.text();
  if (text.length > MAX_DOCUMENT_BYTES) {
    return bad('The client metadata document is too large.');
  }
  const json = parseJson(text);
  return json.ok
    ? parseClientMetadataDocument(json.value, url)
    : bad('The client metadata document is not valid JSON.');
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
        'redirect_uris must list 1–20 https, loopback http or app-scheme URIs.',
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
