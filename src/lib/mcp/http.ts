/**
 * @packageDocumentation
 *
 * The HTTP side of the MCP endpoints: read a JSON-RPC message (or batch), check
 * it is well formed and that the caller's scopes and rate limit cover it, hand
 * it to the MCP server, and write the reply. Used by the OAuth-protected
 * `/api/mcp`.
 *
 * The order matters. The size cap comes before the JSON is parsed; envelope and
 * header checks come before anything is run; the scope check comes before the
 * rate limit (a refused call costs nothing); and every refusal that can name the
 * request it answers carries that request's id.
 */

import { NextResponse } from 'next/server';

import type { User } from '../db/users';
import { CORS_HEADERS } from '../oauth/http';
import { wwwAuthenticate } from '../oauth/metadata';
import { SCOPE_READ, hasScope, scopeForMessage } from '../oauth/scopes';
import { getEnvSafe } from './env';
import {
  ERROR_INVALID_REQUEST,
  ERROR_METHOD_NOT_FOUND,
  ERROR_PARSE,
  checkBatch,
  checkRequestHeaders,
  errorBody,
  headerVersion,
  isAllowedOrigin,
  isModernRequest,
  parseMessage,
  protocolRefusal,
  withoutId,
  MODERN_VERSION,
  replyIdOf,
  type ProtocolMessage,
  type ProtocolRefusal,
} from './protocol';
import {
  MAX_BATCH,
  checkRateLimits,
  liveRateLimitDeps,
  readJsonBody,
  type RateLimitDeps,
} from './request-limits';
import {
  handleMcpMessage,
  isAdvertisedTool,
  type JsonRpcResponse,
} from './server';

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
    errorBody(ERROR_INVALID_REQUEST, 'Origin not allowed'),
    { status: 403 },
  );
}

/**
 * The 401 that starts the sign-in flow (no token) or reports a bad one
 * (`invalidToken`). Its `WWW-Authenticate` points the assistant at the
 * discovery documents. The status and that header are what tell a client to
 * sign in; the JSON-RPC body is only a courtesy, and it carries no id because
 * the request was never read.
 */
export function unauthorizedResponse(
  origin: string,
  invalidToken: boolean,
  cors: Readonly<Record<string, string>>,
): NextResponse {
  return NextResponse.json(
    errorBody(ERROR_INVALID_REQUEST, 'Authorization required'),
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
    headers: { ...cors, ...refusal.headers },
  });
}

/** An empty 202: the answer to notifications, and to replies we have nothing to say to. */
function accepted(cors: Readonly<Record<string, string>>): NextResponse {
  return new NextResponse(null, { status: 202, headers: cors });
}

/** A 400 for a body that cannot be taken as one message or a batch of them. */
function invalidRequest(message: string): ProtocolRefusal {
  return protocolRefusal({
    status: 400,
    code: ERROR_INVALID_REQUEST,
    message,
  });
}

/**
 * The scope a message needs. A call to a tool we don't have needs only the
 * ability to read, so the caller is told the tool does not exist rather than
 * that they lack a scope for something that isn't there.
 */
function requiredScope(message: ProtocolMessage): string {
  return message.method === 'tools/call' &&
    !isAdvertisedTool(message.params?.['name'])
    ? SCOPE_READ
    : scopeForMessage(message);
}

/** The refusal for a message the token's scopes don't cover, or null if all are covered. */
function scopeRefusal(
  messages: readonly ProtocolMessage[],
  scopes: readonly string[],
  origin: string,
): ProtocolRefusal | null {
  const denied = messages
    .map((message) => ({ message, needed: requiredScope(message) }))
    .find(({ needed }) => !hasScope(scopes, needed));
  return denied
    ? protocolRefusal({
        status: 403,
        code: ERROR_INVALID_REQUEST,
        message: `Requires the ${denied.needed} scope`,
        id: replyIdOf(denied.message.id),
        headers: {
          'WWW-Authenticate': wwwAuthenticate(origin, {
            error: 'insufficient_scope',
            scope: denied.needed,
          }),
        },
      })
    : null;
}

/** Whether a reply is the "no such method" error. */
function isUnknownMethod(reply: JsonRpcResponse): boolean {
  return 'error' in reply && reply.error.code === ERROR_METHOD_NOT_FOUND;
}

/**
 * Handle one POST of JSON-RPC. `scopes` is what the caller was granted; `rate`
 * says where the per-user rate-limit counters live (the real database unless a
 * test passes its own).
 *
 * Answers 200 with the reply (404 for an unknown method in the newest
 * revision), 202 for notifications and for replies a client sent us, 400 for a
 * malformed message or mismatched headers, 403 for a missing scope, 413 for an
 * oversized body and 429 (with `Retry-After`) for a caller over their limit.
 */
export async function handleMcpPost(
  request: Request,
  user: Readonly<User>,
  scopes: readonly string[],
  origin: string,
  rate: RateLimitDeps = liveRateLimitDeps(),
): Promise<NextResponse> {
  const cors = corsFor(request);
  const body = await readJsonBody(request);
  if (body.kind === 'too-large') {
    return refuse(
      protocolRefusal({
        status: 413,
        code: ERROR_INVALID_REQUEST,
        message: 'Request body too large.',
      }),
      cors,
    );
  }
  if (body.kind === 'unparseable') {
    return refuse(
      protocolRefusal({
        status: 400,
        code: ERROR_PARSE,
        message: 'Parse error',
      }),
      cors,
    );
  }

  const isBatch = Array.isArray(body.value);
  const items: readonly unknown[] = Array.isArray(body.value)
    ? body.value
    : [body.value];
  // A batch must be a sensible size (its messages run side by side).
  if (items.length === 0 || items.length > MAX_BATCH) {
    return refuse(invalidRequest('Invalid Request'), cors);
  }
  const parsed = items.map(parseMessage);
  const unreadable = parsed.find((p) => p.kind === 'invalid');
  if (unreadable) {
    return refuse(
      isBatch ? withoutId(unreadable.refusal) : unreadable.refusal,
      cors,
    );
  }
  // Replies to things a server asked are not ours to answer (we ask nothing).
  const messages = parsed.flatMap((p) => ('message' in p ? [p.message] : []));
  if (messages.length === 0) {
    return headerVersion(request.headers) === MODERN_VERSION
      ? refuse(
          invalidRequest(
            `Protocol ${MODERN_VERSION} clients must not send replies.`,
          ),
          cors,
        )
      : accepted(cors);
  }

  const refusal =
    (isBatch ? checkBatch(request.headers, messages) : null) ??
    messages
      .map((message) => checkRequestHeaders(request.headers, message))
      .find((found) => found !== null) ??
    scopeRefusal(messages, scopes, origin) ??
    (await checkRateLimits(user, messages, rate));
  if (refusal) {
    return refuse(isBatch ? withoutId(refusal) : refusal, cors);
  }

  const replies = await Promise.all(
    messages.map((m) => handleMcpMessage(user, m)),
  );
  if (isBatch) {
    const answered = replies.filter((r) => r !== null);
    return answered.length > 0
      ? NextResponse.json(answered, { headers: cors })
      : accepted(cors);
  }
  const [reply] = replies;
  const [message] = messages;
  if (!reply) {
    return accepted(cors);
  }
  // The newest revision wants an unknown method as a 404, not a plain 200.
  const status =
    message !== undefined && isModernRequest(message) && isUnknownMethod(reply)
      ? 404
      : 200;
  return NextResponse.json(reply, { status, headers: cors });
}
