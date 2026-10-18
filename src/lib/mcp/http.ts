/**
 * @packageDocumentation
 *
 * The HTTP side of the MCP endpoints: read a JSON-RPC message (or batch), check
 * the caller's scopes cover it, hand it to the MCP server, and write the reply.
 * Shared by the OAuth-protected `/api/mcp` and the legacy secret-link
 * `/api/mcp/<token>`, which differ only in how they identify the user.
 */

import { NextResponse } from 'next/server';

import type { User } from '../db/users';
import { CORS_HEADERS } from '../oauth/http';
import { wwwAuthenticate } from '../oauth/metadata';
import { hasScope, scopeForMessage } from '../oauth/scopes';
import { getEnvSafe } from './env';
import {
  checkRequestHeaders,
  isAllowedOrigin,
  isModernRequest,
  type ProtocolRefusal,
} from './protocol';
import { handleMcpMessage, type JsonRpcMessage } from './server';

/**
 * The refusal for a request from an origin we don't allow, or null. Browsers
 * send `Origin` on cross-site requests; an unknown one is turned away with a 403
 * before anything is read.
 */
export function originRefusal(
  request: Request,
  selfOrigin: string,
): NextResponse | null {
  const origin = request.headers.get('origin');
  if (isAllowedOrigin(origin, selfOrigin, getEnvSafe('MCP_ALLOWED_ORIGINS'))) {
    return null;
  }
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'Origin not allowed' },
    },
    { status: 403 },
  );
}

/** CORS headers for an endpoint that checks origins: echo the caller's, not "*". */
export function corsFor(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  return origin
    ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : CORS_HEADERS;
}

/** A protocol refusal as an HTTP response. */
function refuse(refusal: ProtocolRefusal, cors: Record<string, string>) {
  return NextResponse.json(refusal.body, {
    status: refusal.status,
    headers: cors,
  });
}

const rpcError = (code: number, message: string) => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message },
});

/**
 * Handle one POST of JSON-RPC. `scopes` is what the caller may do; `null`
 * means unrestricted (the legacy link, which has always been full access).
 */
export async function handleMcpPost(
  request: Request,
  user: User,
  scopes: string[] | null,
  origin: string,
): Promise<NextResponse> {
  const cors = corsFor(request);
  const payload = (await request.json().catch(() => null)) as
    | JsonRpcMessage
    | JsonRpcMessage[]
    | null;
  if (!payload) {
    return NextResponse.json(rpcError(-32700, 'Parse error'), {
      status: 400,
      headers: cors,
    });
  }
  const messages = Array.isArray(payload) ? payload : [payload];

  for (const message of messages) {
    const refusal = checkRequestHeaders(request.headers, message);
    if (refusal) {
      return refuse(refusal, cors);
    }
  }

  if (scopes !== null) {
    const missing = messages
      .map((m) => scopeForMessage(m))
      .find((needed) => !hasScope(scopes, needed));
    if (missing) {
      return NextResponse.json(
        rpcError(-32001, `Requires the ${missing} scope`),
        {
          status: 403,
          headers: {
            ...cors,
            'WWW-Authenticate': wwwAuthenticate(origin, {
              error: 'insufficient_scope',
              scope: missing,
            }),
          },
        },
      );
    }
  }

  if (Array.isArray(payload)) {
    const responses = (
      await Promise.all(payload.map((m) => handleMcpMessage(user, m)))
    ).filter((r): r is object => r !== null);
    return responses.length > 0
      ? NextResponse.json(responses, { headers: cors })
      : new NextResponse(null, { status: 202, headers: cors });
  }
  const response = await handleMcpMessage(user, payload);
  if (response === null) {
    return new NextResponse(null, { status: 202, headers: cors });
  }
  // The newest revision wants an unknown method as a 404, not a plain 200.
  const unknownMethod =
    isModernRequest(payload) &&
    (response as { error?: { code?: number } }).error?.code === -32601;
  return NextResponse.json(response, {
    status: unknownMethod ? 404 : 200,
    headers: cors,
  });
}
