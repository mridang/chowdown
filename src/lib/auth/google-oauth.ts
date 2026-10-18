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
 * Signing in and connecting Drive are two separate asks. Signing in requests
 * identity only (`openid`/`email`/`profile`); connecting Drive is a second,
 * deliberate step that adds `drive.file` (per-file Drive access to what the app
 * creates) and the refresh token that goes with it. All scopes are
 * non-sensitive, so the app needs no Google security assessment.
 */

/** What signing in asks Google for: who the person is, nothing else. */
export const SIGN_IN_SCOPES = ['openid', 'email', 'profile'] as const;

/** The one Drive permission chowdown uses: files the app itself created. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * What connecting Drive asks for. `openid` rides along so the answer says which
 * Google account approved it (checked against the signed-in person); Google
 * already holds the identity grant, so it adds nothing to the consent screen.
 */
export const DRIVE_SCOPES = ['openid', DRIVE_SCOPE] as const;

/** Which of the two asks a Google round trip is for. */
export type AuthPurpose = 'signin' | 'drive';

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
  /**
   * The scopes actually granted, space-separated. Google lets people untick
   * individual permissions on the consent screen, so this can be fewer than
   * were asked for.
   */
  scope?: string;
}

/** Whether a token response's granted scopes include Drive access. */
export function grantedDrive(scope: string | undefined): boolean {
  return (scope ?? '').split(/\s+/).includes(DRIVE_SCOPE);
}

/**
 * Build the Google consent URL to redirect the user to. `state` is the
 * CSRF/one-time value the callback validates.
 *
 * Signing in asks for identity only, with no refresh token. Connecting Drive
 * asks for `drive.file` on top of what is already granted
 * (`include_granted_scopes`), and `access_type=offline` plus `prompt=consent`
 * guarantee a refresh token is issued (Google omits it on later silent grants
 * otherwise). `loginHint` keeps the account chooser on the signed-in account.
 */
export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  purpose: AuthPurpose;
  loginHint?: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  if (params.purpose === 'drive') {
    url.searchParams.set('scope', DRIVE_SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    if (params.loginHint) {
      url.searchParams.set('login_hint', params.loginHint);
    }
  } else {
    url.searchParams.set('scope', SIGN_IN_SCOPES.join(' '));
  }
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
