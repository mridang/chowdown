/**
 * @packageDocumentation
 *
 * Taking back the Drive login chowdown holds for a person. Used when an
 * account is deleted: the stored refresh token is given back to Google so the
 * permission disappears from the person's Google account too, not just from
 * our database.
 */

import { decryptSecret } from '@/lib/crypto';
import type { User } from '@/domain/db/users';
import { getEnv } from '@/lib/core/runtime';
import { errorMessage, logError } from '@/utils/logging';
import { revokeToken } from '@/domain/auth/drive-oauth';

/**
 * Revoke the person's stored Drive refresh token at Google, if they have one.
 * Best effort: this runs after their data is already gone, and a token that
 * can't be unsealed, or that Google no longer knows, leaves nothing further to
 * do, so failures are logged and swallowed.
 */
export async function revokeDriveLogin(user: Readonly<User>): Promise<void> {
  if (!user.refresh_token_enc) {
    return;
  }
  try {
    const refreshToken = await decryptSecret(
      user.refresh_token_enc,
      getEnv().TOKEN_ENCRYPTION_KEY,
    );
    await revokeToken(refreshToken);
  } catch (error) {
    logError({
      event: 'account.drive_login_revoke_failed',
      error: errorMessage(error),
    });
  }
}
