/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET    /api/users/self   their account
 *   PATCH  /api/users/self   change a preference, where the app has any
 *   DELETE /api/users/self   delete the account and everything kept about it
 *
 * GET and PATCH live in this app's `userSelf` controller, which decides which
 * of them it answers; one it does not register is undefined here, and Next
 * answers 405 for it. DELETE is a thin handler because it clears the session
 * cookie, which the controller's JSON pipeline does not express.
 */

import { NextResponse } from 'next/server';

import { afterAccountDeleted } from '@/domain/account/app';
import { requireUser } from '@/domain/api/auth';
import { userSelf } from '@/domain/api/users';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { deleteAccountData } from '@/domain/db/account';
import { getDatabase } from '@/domain/db/client';

export const dynamic = 'force-dynamic';

export const { GET, PATCH } = userSelf.handlers();

/**
 * `DELETE /api/users/self`: delete the signed-in person's account. Everything
 * the app keeps about them goes at once, their session is ended, and then the
 * app tidies up whatever it holds elsewhere (`domain/account/app.ts`). Answers
 * 204, 401 when nobody is signed in, 403 from another site.
 */
export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;
  await deleteAccountData(getDatabase(), user.id);
  afterAccountDeleted(user);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
