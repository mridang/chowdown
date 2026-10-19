/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET   /api/users/self   their profile and preferences
 *   PATCH /api/users/self   change a preference (JSON Merge Patch)
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { readJsonObject } from '@/lib/api/json';
import { problems } from '@/lib/api/problem';
import { parseUserPatch, userResource } from '@/lib/api/user-resource';
import { getUserById, setUserUnits } from '@/lib/db/users';
import { getDatabase } from '@/lib/util';

/**
 * `GET /api/users/self`: the signed-in user's profile (id, email, name,
 * picture, measurement system). Answers 200, or 401 when nobody is signed in.
 */
export async function GET(request: Request): Promise<NextResponse> {
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
export async function PATCH(request: Request): Promise<NextResponse> {
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
