/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint. An
 * assistant that gets a 401 from `/api/mcp` is pointed here to learn which
 * authorization server to use. Served at the bare well-known path and at the
 * path-inserted form for `/api/mcp`, since clients try both.
 */

import { noStoreJson, preflight } from '@/lib/oauth/http';
import { protectedResourceMetadata } from '@/lib/oauth/metadata';
import { appOrigin } from '@/lib/util';

/**
 * `GET /.well-known/oauth-protected-resource[/api/mcp]`: the discovery document
 * for the MCP endpoint, naming this site as its own authorization server.
 * Public, never cached. Answers 200.
 */
export function GET(request: Request) {
  return noStoreJson(protectedResourceMetadata(appOrigin(request)));
}

/** `OPTIONS /.well-known/oauth-protected-resource[/api/mcp]`: the CORS preflight. Answers 204. */
export function OPTIONS() {
  return preflight();
}
