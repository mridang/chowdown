/**
 * The OAuth-protected MCP endpoint. Assistants connect to this one URL, are
 * sent through the sign-in flow described by the discovery documents, and then
 * call it with `Authorization: Bearer <access token>`. Without a valid token it
 * answers 401 with a `WWW-Authenticate` challenge pointing at those documents.
 *
 *   POST /api/mcp  — JSON-RPC 2.0 (one message, or a batch for older clients)
 */

import { NextResponse } from 'next/server';

import type { User } from '@/lib/db/users';
import { authenticateMcpRequest } from '@/lib/mcp/auth';
import {
  corsFor,
  handleMcpPost,
  originRefusal,
  unauthorizedResponse,
} from '@/lib/mcp/http';
import { appOrigin } from '@/lib/util';

/** Who got in: the user and the scopes they approved. */
interface Admitted {
  readonly user: Readonly<User>;
  readonly scope: readonly string[];
}

/**
 * Let a request in, or answer it: 403 for an origin that is not allowed, 401
 * for a missing or invalid bearer token.
 */
async function admit(
  request: Request,
  origin: string,
): Promise<Admitted | NextResponse> {
  const refused = originRefusal(request, origin);
  if (refused) {
    return refused;
  }
  const auth = await authenticateMcpRequest(request, origin);
  return auth.kind === 'ok'
    ? auth
    : unauthorizedResponse(
        origin,
        auth.kind === 'invalid-token',
        corsFor(request),
      );
}

/**
 * `POST /api/mcp`: handle a JSON-RPC message (or batch) from an assistant.
 * Answers 200 with the reply (404 for an unknown method in the newest
 * revision), 202 for notifications, 400 for a malformed message or mismatched
 * headers, 401 without a valid bearer token, 403 for an origin that is not
 * allowed or a token that lacks the scope the call needs, 413 for a body over
 * 1 MiB and 429 (with `Retry-After`) for a user over their rate limit.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  const admitted = await admit(request, origin);
  return admitted instanceof NextResponse
    ? admitted
    : handleMcpPost(request, admitted.user, admitted.scope, origin);
}

/** There is no server-initiated stream (nor any session to end): 405. */
async function notAllowed(request: Request): Promise<NextResponse> {
  const admitted = await admit(request, appOrigin(request));
  return admitted instanceof NextResponse
    ? admitted
    : new NextResponse(null, {
        status: 405,
        headers: { ...corsFor(request), Allow: 'POST, OPTIONS' },
      });
}

/**
 * `GET /api/mcp`: the server offers no event stream, so a valid caller gets 405
 * (`Allow: POST, OPTIONS`); everyone else gets the same 401 or 403 as `POST`.
 */
export const GET = notAllowed;

/**
 * `DELETE /api/mcp`: there is no session to end, so a valid caller gets 405
 * (`Allow: POST, OPTIONS`); everyone else gets the same 401 or 403 as `POST`.
 */
export const DELETE = notAllowed;

/**
 * `OPTIONS /api/mcp`: the CORS preflight. Answers 204 with the CORS headers for
 * an allowed origin, or 403 for one that is not.
 */
export function OPTIONS(request: Request): NextResponse {
  const refused = originRefusal(request, appOrigin(request));
  return (
    refused ??
    new NextResponse(null, { status: 204, headers: corsFor(request) })
  );
}
