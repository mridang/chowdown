/**
 * The OAuth-protected MCP endpoint. Assistants connect to this one URL, are
 * sent through the sign-in flow described by the discovery documents, and then
 * call it with `Authorization: Bearer <access token>`. Without a valid token it
 * answers 401 with a `WWW-Authenticate` challenge pointing at those documents.
 *
 *   POST /api/mcp  — JSON-RPC 2.0 (one message or a batch)
 */

import { NextResponse } from 'next/server';

import { getUserById } from '@/lib/db/users';
import { createOAuthStore } from '@/lib/db/oauth';
import { handleMcpPost } from '@/lib/mcp/http';
import { CORS_HEADERS, bearerToken, preflight } from '@/lib/oauth/http';
import { resourceUri, wwwAuthenticate } from '@/lib/oauth/metadata';
import { authenticateAccessToken } from '@/lib/oauth/token-endpoint';
import { appOrigin, getDatabase } from '@/lib/util';

/** The 401 that starts the sign-in flow (or reports a bad token). */
function challenge(origin: string, invalid: boolean): NextResponse {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Authorization required' },
    },
    {
      status: 401,
      headers: {
        ...CORS_HEADERS,
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
  const auth = await authenticate(request, origin);
  if (!auth.token || !auth.identity || !auth.user) {
    return challenge(origin, auth.token);
  }
  return handleMcpPost(request, auth.user, auth.identity.scope, origin);
}

/** There is no server-initiated stream; clients fall back to POST only. */
export async function GET(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  const auth = await authenticate(request, origin);
  if (!auth.token || !auth.identity || !auth.user) {
    return challenge(origin, auth.token);
  }
  return new NextResponse(null, {
    status: 405,
    headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' },
  });
}

export function OPTIONS() {
  return preflight();
}
