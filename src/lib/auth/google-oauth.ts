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

/** Where people are sent to approve the request. */
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
/** Where codes and refresh tokens are traded for access tokens. */
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
/** Who the person behind an access token is. */
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * The identity fields we keep from the OpenID userinfo response. Only `sub` is
 * always there: a grant that carries just `openid` (connecting Drive, when the
 * earlier identity grant has been revoked) answers with nothing else, and the
 * Drive step only needs to know which account approved.
 */
export interface GoogleUser {
  readonly sub: string;
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string;
}

/** Tokens returned by the authorization-code exchange. */
export interface TokenResponse {
  readonly access_token: string;
  /** Present only on the first consent (or with `prompt=consent`). */
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly id_token?: string;
  /**
   * The scopes actually granted, space-separated. Google lets people untick
   * individual permissions on the consent screen, so this can be fewer than
   * were asked for.
   */
  readonly scope?: string;
}

/** A short-lived access token minted from a refresh token. */
export interface AccessTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
}

/** Whether a value is an object with a string at `key`. */
function hasString(value: object, key: string): boolean {
  return typeof Reflect.get(value, key) === 'string';
}

/** Whether a parsed response carries an access token and its lifetime. */
function isAccessTokenResponse(value: unknown): value is AccessTokenResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasString(value, 'access_token') &&
    'expires_in' in value &&
    typeof value.expires_in === 'number'
  );
}

/** Whether a parsed response is a user we can use: it names who they are. */
function isGoogleUser(value: unknown): value is GoogleUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasString(value, 'sub') &&
    (!('email' in value) || typeof value.email === 'string')
  );
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
export function buildAuthUrl(
  params: Readonly<{
    clientId: string;
    redirectUri: string;
    state: string;
    purpose: AuthPurpose;
    loginHint?: string;
  }>,
): string {
  const purposeParams: Readonly<Record<string, string>> =
    params.purpose === 'drive'
      ? {
          scope: DRIVE_SCOPES.join(' '),
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
          ...(params.loginHint ? { login_hint: params.loginHint } : {}),
        }
      : { scope: SIGN_IN_SCOPES.join(' ') };
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    ...purposeParams,
    state: params.state,
  });
  return `${AUTH_ENDPOINT}?${query}`;
}

/** POST a form to Google's token endpoint and return the parsed answer; `what` names the step in the error. */
async function postToken(
  form: Readonly<Record<string, string>>,
  what: string,
): Promise<unknown> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  if (!response.ok) {
    throw new Error(
      `${what} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(
  params: Readonly<{
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }>,
): Promise<TokenResponse> {
  const tokens = await postToken(
    {
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    },
    'Token exchange',
  );
  if (!isAccessTokenResponse(tokens)) {
    throw new Error('Token exchange failed: unexpected response');
  }
  return tokens;
}

/**
 * Mint a fresh access token from a stored refresh token. Used per request
 * (access tokens are short-lived) and by the headless MCP/sync paths.
 */
export async function refreshAccessToken(
  params: Readonly<{
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }>,
): Promise<AccessTokenResponse> {
  const tokens = await postToken(
    {
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
    },
    'Token refresh',
  );
  if (!isAccessTokenResponse(tokens)) {
    throw new Error('Token refresh failed: unexpected response');
  }
  return tokens;
}

/** Fetch the signed-in user's identity from the OpenID userinfo endpoint. */
export async function getUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`userinfo failed: ${response.status}`);
  }
  const user: unknown = await response.json();
  if (!isGoogleUser(user)) {
    throw new Error('userinfo failed: unexpected response');
  }
  return user;
}
