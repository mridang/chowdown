/**
 * Token revocation (RFC 7009). Ends the grant the token belongs to, so the
 * access and refresh tokens stop working together. Answers 200 whether or not
 * the token was known, so it can't be used to probe for valid tokens.
 */

import { createOAuthStore } from '@/lib/db/oauth';
import { noStoreJson, oauthError, preflight } from '@/lib/oauth/http';
import { formField } from '@/lib/oauth/token-request';
import { revokeToken } from '@/lib/oauth/token-endpoint';
import { getDatabase } from '@/lib/util';

/**
 * `POST /oauth/revoke`: revoke the grant behind `token` (a form field).
 * Anyone holding a token may call it. Answers 200 with `{}` whether or not the
 * token was known, or 400 when the `token` field is missing.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = form && formField(form, 'token');
  if (!token) {
    return oauthError('invalid_request', 'The request has no token.');
  }
  await revokeToken(createOAuthStore(getDatabase()), token);
  return noStoreJson({});
}

/** `OPTIONS /oauth/revoke`: the CORS preflight for browser-based assistants. Answers 204. */
export function OPTIONS() {
  return preflight();
}
