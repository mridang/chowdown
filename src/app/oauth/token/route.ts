/**
 * The token endpoint. Redeems an authorization code (with its PKCE verifier)
 * for an access + refresh token, or exchanges a refresh token for a new pair.
 *
 *   POST /oauth/token  (application/x-www-form-urlencoded)
 */

import { createOAuthStore } from '@/lib/db/oauth';
import { noStoreJson, oauthError, preflight } from '@/lib/oauth/http';
import { isOurResource } from '@/lib/oauth/metadata';
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
} from '@/lib/oauth/token-endpoint';
import { appOrigin, getDatabase } from '@/lib/util';

const field = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);
  return typeof value === 'string' && value !== '' ? value : undefined;
};

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return oauthError('invalid_request', 'Send the request as a form.');
  }
  const clientId = field(form, 'client_id');
  if (!clientId) {
    return oauthError('invalid_client', 'The request has no client_id.', 401);
  }

  const store = createOAuthStore(getDatabase());
  const origin = appOrigin(request);
  const now = Math.floor(Date.now() / 1000);
  const grantType = field(form, 'grant_type');

  let result;
  if (grantType === 'authorization_code') {
    const code = field(form, 'code');
    if (!code) {
      return oauthError('invalid_request', 'The request has no code.');
    }
    result = await exchangeAuthorizationCode(
      store,
      {
        code,
        clientId,
        redirectUri: field(form, 'redirect_uri'),
        codeVerifier: field(form, 'code_verifier'),
        resource: field(form, 'resource'),
      },
      (resource) => isOurResource(resource, origin),
      now,
    );
  } else if (grantType === 'refresh_token') {
    const refreshToken = field(form, 'refresh_token');
    if (!refreshToken) {
      return oauthError('invalid_request', 'The request has no refresh_token.');
    }
    result = await exchangeRefreshToken(
      store,
      { refreshToken, clientId, scope: field(form, 'scope') },
      now,
    );
  } else {
    return oauthError(
      'unsupported_grant_type',
      'Use authorization_code or refresh_token.',
    );
  }

  if ('ok' in result) {
    return oauthError(result.error, result.description);
  }
  return noStoreJson(result);
}

export function OPTIONS() {
  return preflight();
}
