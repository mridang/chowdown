/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET    /api/users/self   their profile and preferences
 *   PATCH  /api/users/self   change a preference (JSON Merge Patch)
 *   DELETE /api/users/self   delete the account and everything chowdown keeps
 *
 * GET and PATCH live in the `userSelf` controller; DELETE is a thin handler
 * because it clears the session cookie and revokes Drive in the background,
 * which the controller's JSON pipeline does not express.
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/domain/api/auth';
import { userSelf } from '@/domain/api/users';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { revokeDriveLogin } from '@/domain/auth/drive-login';
import { forgetAccessTokens } from '@/domain/auth/user-access-token';
import { deleteAccountData } from '@/domain/db/account';
import { getDatabase, runInBackground } from '@/core/runtime';

export const dynamic = 'force-dynamic';

export const { GET, PATCH } = userSelf.handlers();

/**
 * `DELETE /api/users/self`: delete the signed-in person's account. Everything
 * chowdown keeps goes at once, their session is ended and the Drive permission
 * is given back to Google; the recipe files in their own Drive are left as they
 * are. Answers 204, 401 when nobody is signed in, 403 from another site.
 */
export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;
  await deleteAccountData(getDatabase(), user.id);
  forgetAccessTokens(user.id);
  // After the response: a slow or failing Google must not undo a deletion
  // that has already happened.
  runInBackground(revokeDriveLogin(user));
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
