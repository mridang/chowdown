/**
 * @packageDocumentation
 *
 * The Google side of connecting Drive, a step of its own after signing in. The
 * refresh token it yields is sealed and stored (see lib/crypto + db/users);
 * only the short-lived access token is used per request. That is what the
 * headless MCP write tools and background sync need: Drive access while the
 * person is away.
 *
 * Connecting Drive adds `drive.file` (per-file Drive access to what the app
 * creates) on top of the identity grant. All scopes are non-sensitive, so the
 * app needs no Google security assessment.
 */

import { GoogleOAuthClient, type AccessTokenResponse } from '@/lib/google';

/** The one Drive permission chowdown uses: files the app itself created. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * What connecting Drive asks for. `openid` rides along so the answer says which
 * Google account approved it (checked against the signed-in person); Google
 * already holds the identity grant, so it adds nothing to the consent screen.
 */
export const DRIVE_SCOPES = ['openid', DRIVE_SCOPE] as const;

/** Whether a token response's granted scopes include Drive access. */
export function grantedDrive(scope: string | undefined): boolean {
  return (scope ?? '').split(/\s+/).includes(DRIVE_SCOPE);
}

/**
 * The Google consent URL for connecting Drive: `drive.file` on top of what is
 * already granted (`include_granted_scopes`), and `access_type=offline` plus
 * `prompt=consent` to guarantee a refresh token is issued (Google omits it on
 * later silent grants otherwise). `loginHint` keeps the account chooser on the
 * signed-in account.
 */
export function buildDriveAuthUrl(
  params: Readonly<{
    clientId: string;
    redirectUri: string;
    state: string;
    loginHint?: string;
  }>,
): string {
  return new GoogleOAuthClient({ clientId: params.clientId }).authUrl({
    redirectUri: params.redirectUri,
    state: params.state,
    scopes: DRIVE_SCOPES,
    extra: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      ...(params.loginHint ? { login_hint: params.loginHint } : {}),
    },
  });
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
  const result = await new GoogleOAuthClient({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
  }).refreshAccessToken({ refreshToken: params.refreshToken });
  if (!result.ok) {
    if (result.status === undefined) {
      // A transport error (the fetch itself failed): propagate it unchanged so
      // a transient failure is not mistaken for a revoked login.
      throw new Error(result.error);
    }
    // A 2xx with the wrong shape is "unexpected"; a real HTTP failure keeps its
    // status and body in the message so a revoked login can be recognised (see
    // drive-access `isAuthFailure`).
    throw new Error(
      result.status < 400
        ? 'Token refresh failed: unexpected response'
        : `Token refresh failed: ${result.status} ${result.raw}`,
    );
  }
  return result.value;
}

/**
 * Give a refresh token back to Google, ending chowdown's access to the
 * person's Drive on Google's side too (revoking a refresh token revokes the
 * access tokens minted from it). Throws if Google refuses; an already-revoked
 * token is an `invalid_token` refusal, which callers deleting an account are
 * free to ignore.
 */
export async function revokeToken(refreshToken: string): Promise<void> {
  // Revoking needs no client credentials, only the token itself.
  const result = await new GoogleOAuthClient({ clientId: '' }).revoke({
    token: refreshToken,
  });
  if (!result.ok) {
    throw new Error(`Token revocation failed: ${result.status}`);
  }
}
