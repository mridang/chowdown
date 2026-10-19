/**
 * All of the caller's sessions at once.
 *
 *   DELETE /api/sessions → 204
 *
 * "Sign out everywhere": a session cookie is a signed token with no server-side
 * record, so it cannot be deleted one by one. Instead the account moves to the
 * next session epoch, and every cookie issued under the old one (this browser's
 * included) stops being accepted.
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { bumpSessionEpoch } from '@/lib/db/users';
import { getDatabase } from '@/lib/util';

/**
 * `DELETE /api/sessions`: end every session of the signed-in person, on every
 * device, and clear this browser's cookie. Answers 204, 401 when nobody is
 * signed in (or the session had already been ended), or 403 for a request from
 * another site.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  await bumpSessionEpoch(getDatabase(), auth.value.id);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
