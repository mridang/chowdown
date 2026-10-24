/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET    /api/users/self   their profile and preferences
 *   PATCH  /api/users/self   change a preference (JSON Merge Patch)
 *   DELETE /api/users/self   delete the account and everything chowdown keeps
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/domain/api/auth';
import { readJsonObject } from '@/lib/rest-json/json';
import { problems } from '@/lib/rest-json/problem';
import { parseUserPatch, userResource } from '@/domain/api/user-resource';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { revokeDriveLogin } from '@/domain/auth/drive-login';
import { forgetAccessTokens } from '@/domain/auth/user-access-token';
import { deleteAccountData } from '@/domain/db/account';
import { getUserById, setUserUnits } from '@/domain/db/users';
import { getDatabase, runInBackground } from '@/core/runtime';

/**
 * `GET /api/users/self`: the signed-in user's profile (id, email, name,
 * picture, measurement system). Answers 200, or 401 when nobody is signed in.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  return NextResponse.json(userResource(auth.value), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}

/**
 * `PATCH /api/users/self`: change the measurement system with a JSON Merge
 * Patch (`{ "measurement_system": "US" }`, or `null` to clear it). Answers 200
 * with the updated profile, 400 for a patch that is not valid (identity fields
 * cannot be edited), 401 when nobody is signed in.
 */
export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJsonObject(
    request,
    'The patch must be a JSON object.',
    ['application/merge-patch+json'],
  );
  if (!body.ok) {
    return body.response;
  }
  const patch = parseUserPatch(body.value);
  if (!patch.ok) {
    return problems.badRequest('The change is not valid.', patch.errors);
  }
  const db = getDatabase();
  if ('measurement_system' in body.value) {
    await setUserUnits(db, auth.value.id, patch.units);
  }
  const updated = (await getUserById(db, auth.value.id)) ?? auth.value;
  return NextResponse.json(userResource(updated));
}

/**
 * `DELETE /api/users/self`: delete the signed-in person's account. Everything
 * chowdown keeps about them goes at once (cached recipes, embeddings, hearts,
 * import drafts, connected assistants and their tokens, the profile), their
 * session is ended and the Drive permission is given back to Google. The
 * recipe files in their own Google Drive are left exactly as they are. Answers
 * 204, 401 when nobody is signed in, 403 for a request from another site.
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
