/**
 * @packageDocumentation
 *
 * Small HTTP helpers shared by the OAuth and MCP route handlers: CORS (browser
 * based assistants call these endpoints cross-origin), JSON error bodies in the
 * OAuth shape, and reading the bearer token.
 */

import { NextResponse } from 'next/server';

/** CORS for endpoints a browser-based client may call. */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
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
  extra: Record<string, string> = {},
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
  extra: Record<string, string> = {},
): NextResponse {
  return noStoreJson({ error, error_description: description }, status, extra);
}

/** The token from an `Authorization: Bearer …` header, if present. */
export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1];
}
