/**
 * @packageDocumentation
 *
 * What the shared sign-in code (`google-oauth`, `oauth-state`, `return-to`,
 * `flow-cookies`, `session`, `session-cookie`, `sign-in`, and the login,
 * callback and sessions routes) needs to know about this app: the names of its
 * cookies, where people land, which extra asks a Google round trip can be
 * for, and what its session cookie carries beyond who the person is. The other
 * per-app modules are `store.ts` (the users table) and `hooks.ts` (what
 * happens after sign-in). Every app has these three, with the same exports.
 */

import type { User } from '../db/users';
import { isDriveConnected } from './drive-access';
import type { SessionPayload } from './session';

/** Name of the session cookie. */
export const SESSION_COOKIE = 'chowdown_session';

/** Name of the short-lived cookie holding the OAuth `state` value. */
export const STATE_COOKIE = 'chowdown_oauth_state';

/** Short-lived cookie holding the path to return to after Google sign-in. */
export const RETURN_COOKIE = 'chowdown_return_to';

/** Where someone lands after signing in, unless they came from somewhere specific. */
export const LANDING_PATH = '/app';

/** Where someone lands when signing in failed, with a fixed flag rather than any detail. */
export const SIGN_IN_FAILED_PATH = '/?error=auth';

/**
 * The asks a Google round trip can be for besides signing in (the label at the
 * front of the `state` value). Connecting Drive is the one this app has.
 */
export const EXTRA_PURPOSES: readonly string[] = ['drive'];

/**
 * Where a page sends a person whose session cookie still verifies but has been
 * ended (they signed out everywhere, or the account was deleted). The route
 * clears the dead cookie before going home; sending them straight home would
 * find the cookie still there, take it for a signed-in visit, and come back.
 */
export const ENDED_SESSION_PATH = '/api/auth/refresh';

/**
 * The claims this app's session cookie carries besides who the person is. They
 * are hints for the header, so it needs no database read: whether Google Drive
 * is connected (`drive`, which `connected` overrides for the moment Drive has
 * just been connected and `user` is the row from before) and the Drive id of
 * the Recipes folder (`folder`, left out until there is one). Pages that need
 * Drive check the database.
 */
export function sessionClaims(
  user: Readonly<Pick<User, 'refresh_token_enc' | 'recipes_folder_id'>>,
  connected: boolean = isDriveConnected(user),
): Readonly<Record<string, string | boolean>> {
  return {
    drive: connected,
    ...(user.recipes_folder_id ? { folder: user.recipes_folder_id } : {}),
  };
}

/**
 * Whether the session says Drive was connected when it was issued, or
 * undefined for one issued before the hint existed (those fall back to a
 * lookup).
 */
export function driveHint(
  session: Readonly<SessionPayload>,
): boolean | undefined {
  return typeof session['drive'] === 'boolean' ? session['drive'] : undefined;
}

/** The Drive id of the person's Recipes folder, if the session knows it. */
export function folderHint(
  session: Readonly<SessionPayload>,
): string | undefined {
  return typeof session['folder'] === 'string' ? session['folder'] : undefined;
}
