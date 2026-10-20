/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint. An
 * assistant that gets a 401 from `/api/mcp` is pointed here to learn which
 * authorization server to use. Served at the bare well-known path and at the
 * path-inserted form for `/api/mcp`, since clients try both. Any other path
 * has no document (RFC 9728 §3.3: the `resource` must match the path it was
 * derived from).
 */

import { NextResponse } from 'next/server';

import { noStoreJson, preflight } from '@/lib/oauth/http';
import {
  isProtectedResourcePath,
  protectedResourceMetadata,
} from '@/lib/oauth/metadata';
import { appOrigin } from '@/lib/util/origin';

/** The route's dynamic segments: the optional rest of the path after the well-known prefix. */
interface Context {
  readonly params: Promise<{ readonly path?: readonly string[] }>;
}

/**
 * `GET /.well-known/oauth-protected-resource[/api/mcp]`: the discovery document
 * for the MCP endpoint, naming this site as its own authorization server.
 * Public, never cached. Answers 200, or 404 for a path that is not the MCP
 * endpoint's.
 */
export async function GET(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const { path } = await params;
  return isProtectedResourcePath(path)
    ? noStoreJson(protectedResourceMetadata(appOrigin(request)))
    : noStoreJson(
        {
          error: 'not_found',
          error_description: 'No protected resource at this path.',
        },
        404,
      );
}

/** `OPTIONS /.well-known/oauth-protected-resource[/api/mcp]`: the CORS preflight. Answers 204. */
export function OPTIONS() {
  return preflight();
}
