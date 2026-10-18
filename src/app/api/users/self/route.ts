/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET   /api/users/self   their profile and preferences
 *   PATCH /api/users/self   change a preference (JSON Merge Patch)
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { isObject, readJson } from '@/lib/api/json';
import { problems } from '@/lib/api/problem';
import { parseUserPatch, userResource } from '@/lib/api/user-resource';
import { getUserById, setUserUnits } from '@/lib/db/users';
import { getDatabase } from '@/lib/util';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  return NextResponse.json(userResource(auth.value), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request, ['application/merge-patch+json']);
  if (!body.ok) {
    return body.response;
  }
  if (!isObject(body.value)) {
    return problems.badRequest('The patch must be a JSON object.');
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
