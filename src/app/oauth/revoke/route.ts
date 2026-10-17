/**
 * Token revocation (RFC 7009). Ends the grant the token belongs to, so the
 * access and refresh tokens stop working together. Answers 200 whether or not
 * the token was known, so it can't be used to probe for valid tokens.
 */

import { createOAuthStore } from '@/lib/db/oauth';
import { noStoreJson, oauthError, preflight } from '@/lib/oauth/http';
import { revokeToken } from '@/lib/oauth/token-endpoint';
import { getDatabase } from '@/lib/util';

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = form?.get('token');
  if (typeof token !== 'string' || token === '') {
    return oauthError('invalid_request', 'The request has no token.');
  }
  await revokeToken(createOAuthStore(getDatabase()), token);
  return noStoreJson({});
}

export function OPTIONS() {
  return preflight();
}
