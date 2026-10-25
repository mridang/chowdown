/**
 * @packageDocumentation
 *
 * A Drive access token for a signed-in person: the sealed refresh token in the
 * database, exchanged for a short-lived access token on demand. Used by the
 * recipe API routes, the MCP tools and the background sync.
 */

import { accessTokenFor } from '@/domain/auth/access-token';
import {
  accessTokenKey,
  createAccessTokenCache,
} from '@/domain/auth/access-token-cache';
import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import { refreshAccessToken } from '@/domain/auth/drive-oauth';
import { decryptSecret } from '@/lib/crypto';
import { clearRefreshToken, type User } from '@/domain/db/users';
import { getEnv } from '@/lib/core/runtime';
import { getDatabase } from '@/domain/db/client';

/** Access tokens already minted by this instance (see the cache module). */
const accessTokens = createAccessTokenCache();

/**
 * A Drive access token for the user. The stored refresh token is traded with
 * Google for one only when this instance has none still fresh for that login
 * (see the cache module), so a burst of Drive work costs one Google call. Throws
 * {@link DriveNotConnectedError} if Drive isn't connected or the stored login
 * is no longer usable (see {@link accessTokenFor} for exactly when).
 */
export async function getUserAccessToken(
  user: Readonly<User>,
): Promise<string> {
  if (!user.refresh_token_enc) {
    throw new DriveNotConnectedError();
  }
  const sealed = user.refresh_token_enc;
  const env = getEnv();
  return accessTokens.resolve(accessTokenKey(user.id, sealed), () =>
    accessTokenFor(sealed, {
      decrypt: (stored) => decryptSecret(stored, env.TOKEN_ENCRYPTION_KEY),
      refresh: (refreshToken) =>
        refreshAccessToken({
          refreshToken,
          clientId: env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        }),
      forget: (stored) => clearRefreshToken(getDatabase(), user.id, stored),
    }),
  );
}

/**
 * Drop any Drive access token this instance is holding for the person, for use
 * when their Drive login is removed (account deletion) so a token cannot
 * outlive the connection it came from.
 */
export function forgetAccessTokens(userId: number): void {
  accessTokens.forgetUser(userId);
}
