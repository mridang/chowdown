/**
 * Every `/.well-known/` address this site has no document for.
 *
 * Clients probe several discovery addresses and move on when one is missing
 * (OAuth and MCP discovery try more than one form). Without this route the
 * miss is the full HTML not-found page, which a browser-based client cannot
 * even read because it carries no CORS headers, and which the Worker has to
 * render for nothing. Next picks the specific folders (`oauth-*`,
 * `security.txt`, `gpc.json`) over this catch-all, so it only sees the rest.
 */

import { CORS_HEADERS, preflight } from '@/lib/oauth/http';

/**
 * `GET /.well-known/<anything else>`: no such document. A small JSON 404 that a
 * browser may read, cacheable for ten minutes so repeat probes stay cheap.
 * (`HEAD` is answered from this too.)
 */
export function GET(): Response {
  return Response.json(
    {
      error: 'not_found',
      error_description: 'No such well-known resource.',
    },
    {
      status: 404,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=600' },
    },
  );
}

/** `OPTIONS /.well-known/<anything else>`: the CORS preflight. Answers 204. */
export function OPTIONS() {
  return preflight();
}
