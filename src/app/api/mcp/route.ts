/**
 * The OAuth-protected MCP endpoint. Assistants connect to this one URL, are
 * sent through the sign-in flow described by the discovery documents, and then
 * call it with `Authorization: Bearer <access token>`. Without a valid token it
 * answers 401 with a `WWW-Authenticate` challenge pointing at those documents.
 *
 *   POST /api/mcp  — JSON-RPC 2.0 (one message, or a batch for older clients)
 */

import { NextResponse } from 'next/server';

import { getUserById } from '@/lib/db/users';
import { createOAuthStore } from '@/lib/db/oauth';
import { corsFor, handleMcpPost, originRefusal } from '@/lib/mcp/http';
import { bearerToken } from '@/lib/oauth/http';
import { resourceUri, wwwAuthenticate } from '@/lib/oauth/metadata';
import { authenticateAccessToken } from '@/lib/oauth/token-endpoint';
import { appOrigin, getDatabase } from '@/lib/util';

/** The 401 that starts the sign-in flow (or reports a bad token). */
function challenge(
  origin: string,
  invalid: boolean,
  cors: Record<string, string>,
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
          invalid ? { error: 'invalid_token' } : {},
        ),
      },
    },
  );
}

/** Resolve the bearer token to a user, or null if there isn't a valid one. */
async function authenticate(request: Request, origin: string) {
  const token = bearerToken(request);
  if (!token) {
    return { token: false as const };
  }
  const db = getDatabase();
  const identity = await authenticateAccessToken(
    createOAuthStore(db),
    token,
    resourceUri(origin),
    Math.floor(Date.now() / 1000),
  );
  const user = identity ? await getUserById(db, identity.userId) : undefined;
  return { token: true as const, identity, user };
}

export async function POST(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  const refused = originRefusal(request, origin);
  if (refused) {
    return refused;
  }
  const auth = await authenticate(request, origin);
  if (!auth.token || !auth.identity || !auth.user) {
    return challenge(origin, auth.token, corsFor(request));
  }
  return handleMcpPost(request, auth.user, auth.identity.scope, origin);
}

/** There is no server-initiated stream (nor any session to end): 405. */
async function notAllowed(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  const refused = originRefusal(request, origin);
  if (refused) {
    return refused;
  }
  const auth = await authenticate(request, origin);
  if (!auth.token || !auth.identity || !auth.user) {
    return challenge(origin, auth.token, corsFor(request));
  }
  return new NextResponse(null, {
    status: 405,
    headers: { ...corsFor(request), Allow: 'POST, OPTIONS' },
  });
}

export const GET = notAllowed;
export const DELETE = notAllowed;

export function OPTIONS(request: Request): NextResponse {
  const refused = originRefusal(request, appOrigin(request));
  return (
    refused ??
    new NextResponse(null, { status: 204, headers: corsFor(request) })
  );
}
