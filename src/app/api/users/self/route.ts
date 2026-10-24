/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET    /api/users/self   their profile and preferences
 *   PATCH  /api/users/self   change a preference (JSON Merge Patch)
 *   DELETE /api/users/self   delete the account and everything chowdown keeps
 */

import { NextResponse } from 'next/server';

import { ApiController } from '@/core/api/controller';
import { requireUser, sessionUser } from '@/domain/api/auth';
import { readJsonObject } from '@/lib/rest-json/json';
import { ProblemError, problems } from '@/lib/rest-json/problem';
import { parseUserPatch, userResource } from '@/domain/api/user-resource';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { revokeDriveLogin } from '@/domain/auth/drive-login';
import { forgetAccessTokens } from '@/domain/auth/user-access-token';
import { deleteAccountData } from '@/domain/db/account';
import { getUserById, setUserUnits, type User } from '@/domain/db/users';
import { getDatabase, runInBackground } from '@/core/runtime';

/** A validated preference patch: the raw body (to see which keys were sent) and the parsed units. */
interface ParsedUserPatch {
  readonly body: Readonly<Record<string, unknown>>;
  readonly units: string | null;
}

const users = new ApiController<{ readonly user: Readonly<User> }>({
  context: async (request) => ({ user: await sessionUser(request) }),
})
  .on({
    method: 'GET',
    handle: (_input, { user }) => user,
    encode: (user) => ({
      body: userResource(user),
      headers: { 'Cache-Control': 'private, no-cache' },
    }),
  })
  .on<ParsedUserPatch, Readonly<User>>({
    method: 'PATCH',
    decode: async (request): Promise<ParsedUserPatch> => {
      const body = await readJsonObject(
        request,
        'The patch must be a JSON object.',
        ['application/merge-patch+json'],
      );
      if (!body.ok) {
        throw new ProblemError(body.response);
      }
      const patch = parseUserPatch(body.value);
      if (!patch.ok) {
        throw new ProblemError(
          problems.badRequest('The change is not valid.', patch.errors),
        );
      }
      return { body: body.value, units: patch.units };
    },
    handle: async ({ body, units }, { user }) => {
      const db = getDatabase();
      if ('measurement_system' in body) {
        await setUserUnits(db, user.id, units);
      }
      return (await getUserById(db, user.id)) ?? user;
    },
    encode: (updated) => ({ body: userResource(updated) }),
  });

/**
 * `GET /api/users/self`: the signed-in user's profile (id, email, name,
 * picture, measurement system). Answers 200, or 401 when nobody is signed in.
 */
export const GET = users.handler('GET');

/**
 * `PATCH /api/users/self`: change the measurement system with a JSON Merge
 * Patch (`{ "measurement_system": "US" }`, or `null` to clear it). Answers 200
 * with the updated profile, 400 for a patch that is not valid (identity fields
 * cannot be edited), 401 when nobody is signed in.
 */
export const PATCH = users.handler('PATCH');

/**
 * `DELETE /api/users/self`: delete the signed-in person's account. Thin and
 * bespoke: it clears the session cookie on the response and revokes Drive in
 * the background, which the controller's JSON pipeline does not express.
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
