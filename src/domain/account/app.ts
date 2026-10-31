/**
 * @packageDocumentation
 *
 * What this app does of its own when someone deletes their account, after the
 * shared route (`app/api/users/self/route.ts`) has removed every row kept about
 * them: chowdown forgets the Google access tokens it holds for them in memory
 * and gives the Drive permission back to Google. The recipe files in their own
 * Drive are left as they are.
 */

import { revokeDriveLogin } from '@/domain/auth/drive-login';
import { forgetAccessTokens } from '@/domain/auth/user-access-token';
import type { User } from '@/domain/db/users';
import { runInBackground } from '@/lib/core/runtime';

/**
 * Tidy up after `user`'s account was deleted. The Drive permission is handed
 * back after the response: a slow or failing Google must not undo a deletion
 * that has already happened.
 */
export function afterAccountDeleted(user: Readonly<User>): void {
  forgetAccessTokens(user.id);
  runInBackground(revokeDriveLogin(user));
}
