/**
 * The token endpoint. Redeems an authorization code (with its PKCE verifier)
 * for an access + refresh token, or exchanges a refresh token for a new pair.
 *
 *   POST /oauth/token  (application/x-www-form-urlencoded)
 */

import { createOAuthStore } from '@/lib/db/oauth';
import { noStoreJson, oauthError, preflight } from '@/lib/oauth/http';
import { handleTokenRequest } from '@/lib/oauth/token-request';
import { appOrigin, getDatabase } from '@/lib/util';

/**
 * `POST /oauth/token`: trade an authorization code (`grant_type=
 * authorization_code`) or a refresh token (`grant_type=refresh_token`) for a
 * new access and refresh token. Anyone may call it; the code, verifier and
 * client decide whether it works. Answers 200 with the tokens (never cached),
 * 401 for a missing `client_id`, and 400 with an OAuth error for anything else.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return oauthError('invalid_request', 'Send the request as a form.');
  }
  const result = await handleTokenRequest(
    form,
    createOAuthStore(getDatabase()),
    appOrigin(request),
    Math.floor(Date.now() / 1000),
  );
  return result.ok
    ? noStoreJson(result.tokens)
    : oauthError(result.error, result.description, result.status);
}

/** `OPTIONS /oauth/token`: the CORS preflight for browser-based assistants. Answers 204. */
export function OPTIONS() {
  return preflight();
}
