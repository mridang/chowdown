/**
 * @packageDocumentation
 *
 * Validating an authorization request (`/oauth/authorize`). The order of the
 * checks matters: until the client and its redirect URI are verified we must
 * NOT redirect anywhere (an attacker could use us as an open redirect), so
 * those errors are shown to the user. Once they are verified, every other
 * problem is reported to the client by redirecting back with an `error`.
 */

import type { OAuthClient } from './client';
import { isWellFormedChallenge } from './pkce';
import { isOurResource, resourceUri } from './metadata';
import { redirectUriMatches } from './redirect-uri';
import { normaliseScope } from './scopes';

/** A validated authorization request. */
export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  state: string | undefined;
  codeChallenge: string;
  scope: string[];
  resource: string;
}

/** The result of validating one. */
export type AuthorizeCheck =
  | { ok: true; request: AuthorizeRequest }
  | {
      ok: false;
      /** OAuth error code. */
      error: string;
      description: string;
      /**
       * Where to send the error. Absent when the client or redirect URI could
       * not be trusted, in which case the error is shown to the user instead.
       */
      redirect?: { uri: string; state: string | undefined };
    };

/** The query/form parameters we read. */
export type AuthorizeParams = Record<string, string | undefined>;

/**
 * Check an authorization request against the client registry.
 * `resolveClient` looks a client up (fetching its metadata document if needed).
 */
export async function validateAuthorizeRequest(
  params: AuthorizeParams,
  origin: string,
  resolveClient: (clientId: string) => Promise<OAuthClient | undefined>,
): Promise<AuthorizeCheck> {
  const clientId = params['client_id'];
  if (!clientId) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'The request has no client_id.',
    };
  }
  const client = await resolveClient(clientId);
  if (!client) {
    return {
      ok: false,
      error: 'invalid_client',
      description: 'This application is not known to chowdown.',
    };
  }

  // A client with one registered URI may omit it; otherwise it must match.
  const requested = params['redirect_uri'];
  const redirectUri =
    requested ??
    (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (!redirectUri) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'The request has no redirect_uri.',
    };
  }
  if (!redirectUriMatches(redirectUri, client.redirectUris)) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'The redirect_uri is not one this application registered.',
    };
  }

  // From here on the redirect target is trusted, so report errors to the client.
  const state = params['state'];
  const fail = (error: string, description: string): AuthorizeCheck => ({
    ok: false,
    error,
    description,
    redirect: { uri: redirectUri, state },
  });

  if (params['response_type'] !== 'code') {
    return fail(
      'unsupported_response_type',
      'Only response_type=code is supported.',
    );
  }
  const codeChallenge = params['code_challenge'];
  if (!codeChallenge || params['code_challenge_method'] !== 'S256') {
    return fail(
      'invalid_request',
      'PKCE with code_challenge_method=S256 is required.',
    );
  }
  if (!isWellFormedChallenge(codeChallenge)) {
    return fail(
      'invalid_request',
      'The code_challenge is not a valid S256 challenge.',
    );
  }
  const resource = params['resource'];
  if (resource !== undefined && !isOurResource(resource, origin)) {
    return fail('invalid_target', 'The resource is not this MCP server.');
  }
  const scope = normaliseScope(params['scope']);
  if (scope.length === 0) {
    return fail('invalid_scope', 'None of the requested scopes are supported.');
  }

  return {
    ok: true,
    request: {
      client,
      redirectUri,
      state,
      codeChallenge,
      scope,
      resource: resourceUri(origin),
    },
  };
}

/** Add parameters to a redirect URI, keeping any query it already has. */
export function redirectWith(
  uri: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
