/**
 * @packageDocumentation
 *
 * The signed-in user's profile API as a controller over the `core/api`
 * framework: reading it and changing a preference. Deleting the account is
 * bespoke (it clears the session cookie and revokes Drive in the background),
 * so that stays a thin handler in the route file.
 */

import { ApiController } from '@/core/api/controller';
import { sessionUser } from '@/domain/api/auth';
import { readJsonObject } from '@/lib/rest-json/json';
import { problems } from '@/lib/rest-json/problem';
import { parseUserPatch, userResource } from '@/domain/api/user-resource';
import { getUserById, setUserUnits, type User } from '@/domain/db/users';
import { getDatabase } from '@/core/runtime';

/** A validated preference patch: the raw body (to see which keys were sent) and the parsed units. */
interface ParsedUserPatch {
  readonly body: Readonly<Record<string, unknown>>;
  readonly units: string | null;
}

/**
 * `GET /api/users/self`: the signed-in user's profile. 200, 401 when nobody is
 * signed in. `PATCH`: change the measurement system with a JSON Merge Patch;
 * 200 with the updated profile, 400 for an invalid patch, 401 when signed out.
 */
export const userSelf = new ApiController<{ readonly user: Readonly<User> }>({
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
        throw body.response;
      }
      const patch = parseUserPatch(body.value);
      if (!patch.ok) {
        throw problems.badRequest('The change is not valid.', patch.errors);
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
