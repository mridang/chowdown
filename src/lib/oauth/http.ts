/**
 * @packageDocumentation
 *
 * Small HTTP helpers shared by the OAuth and MCP route handlers: CORS (browser
 * based assistants call these endpoints cross-origin), JSON error bodies in the
 * OAuth shape, and reading the bearer token.
 */

import { NextResponse } from 'next/server';

/**
 * CORS for endpoints a browser-based client may call. The MCP headers are
 * spelled as the spec writes them (names are case-insensitive to a browser).
 * `Mcp-Session-Id` and `Last-Event-ID` are for clients of the older revisions,
 * which may send them even though this server keeps no sessions or streams;
 * `traceparent`, `tracestate` and `baggage` carry OpenTelemetry trace context.
 * `DELETE` is listed so such a client's attempt to end a session gets our plain
 * 405 instead of a CORS failure. `Retry-After` is exposed so a page can back
 * off when it is rate limited.
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Authorization',
    'Content-Type',
    'Accept',
    'MCP-Protocol-Version',
    'Mcp-Method',
    'Mcp-Name',
    'Mcp-Session-Id',
    'Last-Event-ID',
    'traceparent',
    'tracestate',
    'baggage',
  ].join(', '),
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Retry-After',
  'Access-Control-Max-Age': '86400',
};

/** The reply to a CORS preflight. */
export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** A JSON response that must never be cached or stored. */
export function noStoreJson(
  body: unknown,
  status = 200,
  extra: Readonly<Record<string, string>> = {},
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store', ...extra },
  });
}

/** An OAuth error response (RFC 6749 §5.2). */
export function oauthError(
  error: string,
  description: string,
  status = 400,
  extra: Readonly<Record<string, string>> = {},
): NextResponse {
  return noStoreJson({ error, error_description: description }, status, extra);
}

/** The token from an `Authorization: Bearer …` header, if present. */
export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1];
}
