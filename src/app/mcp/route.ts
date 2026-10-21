/**
 * The OAuth-protected MCP endpoint. Assistants connect to this one URL, are
 * sent through the sign-in flow described by the discovery documents, and then
 * call it with `Authorization: Bearer <access token>`. Without a valid token it
 * answers 401 with a `WWW-Authenticate` challenge pointing at those documents.
 *
 *   POST /mcp  — JSON-RPC 2.0 (one message, or a batch for older clients)
 *
 * The routing lives in `respondToMcp` (`src/lib/mcp/http.ts`), which the
 * conformance harness runs too; this file only supplies the real token check
 * and this site's origin.
 */

import type { NextResponse } from 'next/server';

import { authenticateMcpRequest } from '@/lib/mcp/auth';
import { respondToMcp } from '@/lib/mcp/http';
import { appOrigin } from '@/lib/util/origin';

/** Answer any request to the endpoint with the real token check. */
function respond(request: Request): Promise<NextResponse> {
  return respondToMcp(request, appOrigin(request), authenticateMcpRequest);
}

/**
 * `POST /mcp`: handle a JSON-RPC message (or batch) from an assistant.
 * Answers 200 with the reply (404 for an unknown method in the newest
 * revision), 202 for notifications, 400 for a malformed message or mismatched
 * headers, 401 without a valid bearer token, 403 for an origin that is not
 * allowed or a token that lacks the scope the call needs, 413 for a body over
 * 1 MiB, 429 (with `Retry-After`) for a user over their rate limit and 503 (with
 * `Retry-After`) when the token could not be checked.
 */
export const POST = respond;

/**
 * `GET /mcp`: the server offers no event stream, so a valid caller gets 405
 * (`Allow: POST, OPTIONS`); everyone else gets the same 401 or 403 as `POST`.
 */
export const GET = respond;

/**
 * `DELETE /mcp`: there is no session to end, so a valid caller gets 405
 * (`Allow: POST, OPTIONS`); everyone else gets the same 401 or 403 as `POST`.
 */
export const DELETE = respond;

/**
 * `OPTIONS /mcp`: the CORS preflight. Answers 204 with the CORS headers for
 * an allowed origin, or 403 for one that is not.
 */
export const OPTIONS = respond;
