/**
 * @packageDocumentation
 *
 * Server-side Google OAuth 2.0 (authorization-code flow). Unlike the old
 * browser-only token flow, this runs on the Worker so we obtain a **refresh
 * token** (`access_type=offline`) and can act on the user's Drive while they
 * are away — which is what the headless MCP write tools and background sync
 * need. The refresh token is sealed and stored (see lib/crypto + db/users);
 * only the short-lived access token is used per request.
 *
 * Scopes are all non-sensitive: identity (`openid`/`email`/`profile`) plus
 * `drive.file` (per-file Drive access to what the app creates/opens). No
 * sensitive or restricted scope is requested, so the app needs no Google
 * security assessment.
 */

/** The OAuth scopes chowdown requests, space-joined at the call site. */
export const OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
] as const;

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** The identity fields we keep from the OpenID userinfo response. */
export interface GoogleUser {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/** Tokens returned by the authorization-code exchange. */
export interface TokenResponse {
  access_token: string;
  /** Present only on the first consent (or with `prompt=consent`). */
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

/**
 * Build the Google consent URL to redirect the user to. `access_type=offline`
 * plus `prompt=consent` guarantees a refresh token is issued (Google omits it
 * on subsequent silent grants otherwise). `state` is the CSRF/one-time value
 * the callback validates.
 */
export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', OAUTH_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', params.state);
  return url.toString();
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Token exchange failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as TokenResponse;
}

/**
 * Mint a fresh access token from a stored refresh token. Used per request
 * (access tokens are short-lived) and by the headless MCP/sync paths.
 */
export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Token refresh failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

/** Fetch the signed-in user's identity from the OpenID userinfo endpoint. */
export async function getUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`userinfo failed: ${response.status}`);
  }
  return (await response.json()) as GoogleUser;
}
