/**
 * @packageDocumentation
 *
 * The HTTP side of the MCP endpoints: read a JSON-RPC message (or batch), check
 * the caller's scopes cover it, hand it to the MCP server, and write the reply.
 * Used by the OAuth-protected `/api/mcp`.
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

/**
 * The 401 that starts the sign-in flow (no token) or reports a bad one
 * (`invalidToken`). Its `WWW-Authenticate` points the assistant at the
 * discovery documents.
 */
export function unauthorizedResponse(
  origin: string,
  invalidToken: boolean,
  cors: Readonly<Record<string, string>>,
): NextResponse {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Authorization required' },
    },
    {
      status: 401,
      headers: {
        ...cors,
        'WWW-Authenticate': wwwAuthenticate(
          origin,
          invalidToken ? { error: 'invalid_token' } : {},
        ),
      },
    },
  );
}

/** CORS headers for an endpoint that checks origins: echo the caller's, not "*". */
export function corsFor(request: Request): Readonly<Record<string, string>> {
  const origin = request.headers.get('origin');
  return origin
    ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : CORS_HEADERS;
}

/** A protocol refusal as an HTTP response. */
function refuse(
  refusal: ProtocolRefusal,
  cors: Readonly<Record<string, string>>,
): NextResponse {
  return NextResponse.json(refusal.body, {
    status: refusal.status,
    headers: cors,
  });
}

/** The most messages one POST may carry. */
const MAX_BATCH = 20;

/** Whether a parsed JSON value is a plain object (not null, array or scalar). */
export function isMessageObject(value: unknown): value is JsonRpcMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A JSON-RPC error body that answers no particular request. */
const rpcError = (
  code: number,
  message: string,
): {
  readonly jsonrpc: '2.0';
  readonly id: null;
  readonly error: { readonly code: number; readonly message: string };
} => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message },
});

/** A 400 with a JSON-RPC error body. */
function badRequest(
  code: number,
  message: string,
  cors: Readonly<Record<string, string>>,
): NextResponse {
  return NextResponse.json(rpcError(code, message), {
    status: 400,
    headers: cors,
  });
}

/**
 * Handle one POST of JSON-RPC. `scopes` is what the caller was granted.
 */
export async function handleMcpPost(
  request: Request,
  user: Readonly<User>,
  scopes: readonly string[],
  origin: string,
): Promise<NextResponse> {
  const cors = corsFor(request);
  const payload: unknown = await request.json().catch(() => null);
  if (!payload) {
    return badRequest(-32700, 'Parse error', cors);
  }
  const messages: readonly unknown[] = Array.isArray(payload)
    ? payload
    : [payload];
  // Every message must be a JSON object, and a batch must stay a sensible size
  // (its messages run side by side).
  if (
    messages.length === 0 ||
    messages.length > MAX_BATCH ||
    !messages.every(isMessageObject)
  ) {
    return badRequest(-32600, 'Invalid Request', cors);
  }

  const refusal = messages
    .map((message) => checkRequestHeaders(request.headers, message))
    .find((found) => found !== null);
  if (refusal) {
    return refuse(refusal, cors);
  }

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

  const replies = await Promise.all(
    messages.map((m) => handleMcpMessage(user, m)),
  );
  if (Array.isArray(payload)) {
    const answered = replies.filter((r) => r !== null);
    return answered.length > 0
      ? NextResponse.json(answered, { headers: cors })
      : new NextResponse(null, { status: 202, headers: cors });
  }
  const [reply] = replies;
  const [message] = messages;
  if (!reply) {
    return new NextResponse(null, { status: 202, headers: cors });
  }
  // The newest revision wants an unknown method as a 404, not a plain 200.
  const unknownMethod =
    message !== undefined &&
    isModernRequest(message) &&
    'error' in reply &&
    reply.error.code === -32601;
  return NextResponse.json(reply, {
    status: unknownMethod ? 404 : 200,
    headers: cors,
  });
}
