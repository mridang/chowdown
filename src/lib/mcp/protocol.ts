/**
 * @packageDocumentation
 *
 * The protocol rules of the MCP endpoint that don't depend on what the tools do:
 * which protocol versions we speak, how a version is agreed, which origins may
 * call us from a browser, and the checks the newest revision (2026-07-28) puts
 * on every request's HTTP headers.
 *
 * The server speaks two eras at once. Older clients open with an `initialize`
 * handshake and we answer with the newest older version we share with them.
 * Newer clients send their version, name and capabilities with every request
 * (in `_meta`, mirrored into headers) and never handshake; they may ask
 * `server/discover` first. Both are served from the same endpoint, and neither
 * needs a session, because the server keeps no state between requests.
 */

/** The newest revision, which has no handshake and no sessions. */
export const MODERN_VERSION = '2026-07-28';

/** Revisions that open with an `initialize` handshake, newest first. */
export const LEGACY_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

/** Every revision we speak, newest first. */
export const SUPPORTED_VERSIONS: readonly string[] = [
  MODERN_VERSION,
  ...LEGACY_VERSIONS,
];

/** JSON-RPC error codes this module produces. */
export const ERROR_HEADER_MISMATCH = -32020;
export const ERROR_UNSUPPORTED_VERSION = -32022;
export const ERROR_METHOD_NOT_FOUND = -32601;

/**
 * The version to answer an `initialize` with: the one the client asked for if we
 * speak it, otherwise the newest older revision. (Only handshake-based versions
 * are offered here; a client that wants the newest revision does not handshake.)
 */
export function negotiateLegacyVersion(requested: unknown): string {
  return typeof requested === 'string' &&
    (LEGACY_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : LEGACY_VERSIONS[0];
}

/** The keys the newest revision uses in a request's `_meta`. */
const META_VERSION = 'io.modelcontextprotocol/protocolVersion';

/** A JSON-RPC message as far as protocol checks care. */
export interface ProtocolMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown> & { _meta?: Record<string, unknown> };
}

/** The protocol version a request declares in its `_meta`, if it does. */
export function declaredVersion(message: ProtocolMessage): string | undefined {
  const value = message.params?._meta?.[META_VERSION];
  return typeof value === 'string' ? value : undefined;
}

/** Whether a request is in the newest era: it carries its version in `_meta`. */
export function isModernRequest(message: ProtocolMessage): boolean {
  return declaredVersion(message) !== undefined;
}

/** A refusal to send as an HTTP error with a JSON-RPC body. */
export interface ProtocolRefusal {
  status: 400 | 403 | 404;
  body: {
    jsonrpc: '2.0';
    id: null;
    error: { code: number; message: string; data?: unknown };
  };
}

function refusal(
  status: ProtocolRefusal['status'],
  code: number,
  message: string,
  data?: unknown,
): ProtocolRefusal {
  return {
    status,
    body: {
      jsonrpc: '2.0',
      id: null,
      error: { code, message, ...(data === undefined ? {} : { data }) },
    },
  };
}

/** The refusal for a version we don't speak, listing the ones we do. */
function unsupportedVersion(requested: string): ProtocolRefusal {
  return refusal(
    400,
    ERROR_UNSUPPORTED_VERSION,
    'Unsupported protocol version',
    {
      supported: SUPPORTED_VERSIONS,
      requested,
    },
  );
}

/**
 * Check one request's `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name`
 * headers against what it says in its body. Returns the refusal to send, or null
 * when the request is fine.
 *
 *  - A version header we don't speak is refused, whichever era the request is in.
 *  - A newest-era request must carry the version header, it must match the body,
 *    and `Mcp-Method` (and `Mcp-Name` for calls that name something) must match
 *    too: a gateway may route on the headers while we act on the body, so the two
 *    must never disagree.
 *  - An older request (no `_meta` version) may omit all of them.
 */
export function checkRequestHeaders(
  headers: Headers,
  message: ProtocolMessage,
): ProtocolRefusal | null {
  const headerVersion = headers.get('mcp-protocol-version')?.trim();
  if (headerVersion && !SUPPORTED_VERSIONS.includes(headerVersion)) {
    return unsupportedVersion(headerVersion);
  }
  const bodyVersion = declaredVersion(message);
  if (bodyVersion === undefined) {
    return null;
  }
  if (!SUPPORTED_VERSIONS.includes(bodyVersion)) {
    return unsupportedVersion(bodyVersion);
  }
  if (headerVersion !== bodyVersion) {
    return refusal(
      400,
      ERROR_HEADER_MISMATCH,
      `Header mismatch: MCP-Protocol-Version is ${headerVersion ? `"${headerVersion}"` : 'missing'} but the body says "${bodyVersion}".`,
    );
  }
  const method = message.method ?? '';
  if (headers.get('mcp-method') !== method) {
    return refusal(
      400,
      ERROR_HEADER_MISMATCH,
      `Header mismatch: Mcp-Method must be "${method}".`,
    );
  }
  const name = nameOf(message);
  if (
    name !== undefined &&
    decodeHeaderValue(headers.get('mcp-name')) !== name
  ) {
    return refusal(
      400,
      ERROR_HEADER_MISMATCH,
      'Header mismatch: Mcp-Name must be the name or URI the request asks for.',
    );
  }
  return null;
}

/** What a request names, for the calls that name something. */
function nameOf(message: ProtocolMessage): string | undefined {
  const params = message.params ?? {};
  switch (message.method) {
    case 'tools/call':
    case 'prompts/get':
      return typeof params['name'] === 'string' ? params['name'] : undefined;
    case 'resources/read':
      return typeof params['uri'] === 'string' ? params['uri'] : undefined;
    default:
      return undefined;
  }
}

/** A header value, decoding the `=?base64?…?=` form used for non-ASCII values. */
export function decodeHeaderValue(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  const match = /^=\?base64\?(.*)\?=$/.exec(value);
  if (!match) {
    return value;
  }
  try {
    const bytes = Uint8Array.from(atob(match[1]!), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/** The refusal for a method we don't have, which the newest revision wants as a 404. */
export function methodNotFound(): ProtocolRefusal {
  return refusal(404, ERROR_METHOD_NOT_FOUND, 'Method not found');
}

/**
 * Origins that may call the endpoint from a browser, besides our own: the web
 * apps of the assistants that connect to us and local tools such as the MCP
 * Inspector. More can be added with the `MCP_ALLOWED_ORIGINS` setting (a
 * comma-separated list of origins).
 */
const ALLOWED_HOSTS = [
  'claude.ai',
  'claude.com',
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'anthropic.com',
];

/**
 * Whether a request's `Origin` header may reach the endpoint. A request with no
 * `Origin` (a server or a desktop app) is fine. One with an origin we don't
 * recognise is refused, so a web page can't make a visitor's browser talk to the
 * endpoint on its own behalf (DNS rebinding and its cousins).
 */
export function isAllowedOrigin(
  origin: string | null,
  selfOrigin: string,
  extra: string | undefined = undefined,
): boolean {
  if (origin === null || origin === selfOrigin) {
    return true;
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (url.origin !== origin) {
    return false; // an origin has no path
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return true;
  }
  if (
    url.protocol === 'https:' &&
    ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  ) {
    return true;
  }
  return (extra ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .includes(origin);
}
