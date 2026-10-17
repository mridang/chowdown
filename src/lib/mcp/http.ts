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
import { handleMcpMessage, type JsonRpcMessage } from './server';

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
  const payload = (await request.json().catch(() => null)) as
    | JsonRpcMessage
    | JsonRpcMessage[]
    | null;
  if (!payload) {
    return NextResponse.json(rpcError(-32700, 'Parse error'), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
  const messages = Array.isArray(payload) ? payload : [payload];

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
            ...CORS_HEADERS,
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
      ? NextResponse.json(responses, { headers: CORS_HEADERS })
      : new NextResponse(null, { status: 202, headers: CORS_HEADERS });
  }
  const response = await handleMcpMessage(user, payload);
  return response === null
    ? new NextResponse(null, { status: 202, headers: CORS_HEADERS })
    : NextResponse.json(response, { headers: CORS_HEADERS });
}
