/**
 * @packageDocumentation
 *
 * Reading a request to the token endpoint (`/oauth/token`): which grant it
 * asks for, the form fields that grant needs, and handing them to the right
 * exchange in `token-endpoint.ts`. The route only reads the form and writes the
 * answer; the rules live here, where a fake store can test them.
 */

import { isOurResource } from './metadata';
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  type OAuthFailure,
  type OAuthStore,
  type TokenResponse,
} from './token-endpoint';

/** What the endpoint answers with, ready to turn into a response. */
export type TokenRequestResult =
  /** Tokens were issued. */
  | { readonly ok: true; readonly tokens: TokenResponse }
  /** The request was refused; `status` is the HTTP status to send. */
  | {
      readonly ok: false;
      readonly error: string;
      readonly description: string;
      readonly status: 400 | 401;
    };

/** A form field's text, or undefined when it is missing or empty. */
export function formField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Answer one token request. `origin` is this site's public origin (a
 * `resource` in the request must name the MCP server there) and `now` the time
 * in Unix seconds.
 */
export async function handleTokenRequest(
  form: FormData,
  store: OAuthStore,
  origin: string,
  now: number,
): Promise<TokenRequestResult> {
  const clientId = formField(form, 'client_id');
  if (!clientId) {
    return {
      ok: false,
      error: 'invalid_client',
      description: 'The request has no client_id.',
      status: 401,
    };
  }
  const result = await exchange(
    formField(form, 'grant_type'),
    form,
    clientId,
    store,
    origin,
    now,
  );
  return 'ok' in result
    ? {
        ok: false,
        error: result.error,
        description: result.description,
        status: 400,
      }
    : { ok: true, tokens: result };
}

/** An exchange that failed before it began. */
function failure(error: string, description: string): OAuthFailure {
  return { ok: false, error, description };
}

/** Run the exchange the grant type names, or refuse a grant type we do not offer. */
async function exchange(
  grantType: string | undefined,
  form: FormData,
  clientId: string,
  store: OAuthStore,
  origin: string,
  now: number,
): Promise<TokenResponse | OAuthFailure> {
  if (grantType === 'authorization_code') {
    const code = formField(form, 'code');
    return code
      ? exchangeAuthorizationCode(
          store,
          {
            code,
            clientId,
            redirectUri: formField(form, 'redirect_uri'),
            codeVerifier: formField(form, 'code_verifier'),
            resource: formField(form, 'resource'),
          },
          (resource) => isOurResource(resource, origin),
          now,
        )
      : failure('invalid_request', 'The request has no code.');
  }
  if (grantType === 'refresh_token') {
    const refreshToken = formField(form, 'refresh_token');
    return refreshToken
      ? exchangeRefreshToken(
          store,
          { refreshToken, clientId, scope: formField(form, 'scope') },
          now,
        )
      : failure('invalid_request', 'The request has no refresh_token.');
  }
  return failure(
    'unsupported_grant_type',
    'Use authorization_code or refresh_token.',
  );
}
