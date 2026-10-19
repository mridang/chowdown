/**
 * @packageDocumentation
 *
 * Server-side helpers to resolve the signed-in user and obtain a fresh Drive
 * access token for them. Used by Server Components (the `/app` auth gate) and
 * by the recipe API routes. Identity comes from the signed session cookie;
 * Drive access, once the person has connected it, comes from the sealed refresh
 * token in the database, exchanged for a short-lived access token on demand.
 */

import { cookies } from 'next/headers';

import { accessTokenFor } from './access-token';
import { accessTokenKey, createAccessTokenCache } from './access-token-cache';
import { DriveNotConnectedError } from './drive-access';
import { refreshAccessToken } from './google-oauth';
import {
  SESSION_COOKIE,
  sessionIsCurrent,
  verifySessionToken,
  type SessionPayload,
} from './session';
import { decryptSecret } from '../crypto';
import {
  clearRefreshToken,
  getSessionEpoch,
  getUserById,
  type User,
} from '../db/users';
import { getDatabase, getEnv } from '../util';

/** Access tokens already minted by this instance (see the cache module). */
const accessTokens = createAccessTokenCache();

/**
 * The user for the current request, or null when not signed in, the session is
 * invalid or expired, or it was ended (the person signed out everywhere, or the
 * account is gone). Verifies the cookie signature before touching the DB.
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const payload = await verifySessionToken(token, getEnv().SESSION_SECRET);
  if (!payload) {
    return null;
  }
  const user = await getUserById(getDatabase(), payload.uid);
  return user && sessionIsCurrent(payload, user.session_epoch) ? user : null;
}

/**
 * The signed session claims straight from the cookie, with **no database
 * read**. The cookie is HMAC-signed, so a valid one can be trusted for identity;
 * callers that only scope queries by user id (like the recipe page) can skip
 * the `users` lookup entirely and save a network round trip to D1. The `drive`
 * claim is only a hint for the header: check the database before relying on it.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token, getEnv().SESSION_SECRET);
}

/**
 * The signed-in user's id from the session cookie alone (see {@link getSession}).
 * Because nothing is read from the database, a session the person has since
 * ended (signed out everywhere) is still accepted here until it expires: use
 * {@link getLiveSessionUid} for anything that changes data or hands out secrets.
 */
export async function getSessionUid(): Promise<number | null> {
  return (await getSession())?.uid ?? null;
}

/**
 * Like {@link getSessionUid}, but also confirms with one small database read
 * that the session has not been ended and the account still exists. Null in
 * either case.
 */
export async function getLiveSessionUid(): Promise<number | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const epoch = await getSessionEpoch(getDatabase(), session.uid);
  return epoch !== undefined && sessionIsCurrent(session, epoch)
    ? session.uid
    : null;
}

/**
 * A Drive access token for the user. The stored refresh token is traded with
 * Google for one only when this instance has none still fresh for that login
 * (see the cache module), so a burst of Drive work costs one Google call. Throws
 * {@link DriveNotConnectedError} if Drive isn't connected or the stored login
 * is no longer usable (see {@link accessTokenFor} for exactly when).
 */
export async function getUserAccessToken(
  user: Readonly<User>,
): Promise<string> {
  if (!user.refresh_token_enc) {
    throw new DriveNotConnectedError();
  }
  const sealed = user.refresh_token_enc;
  const env = getEnv();
  return accessTokens.resolve(accessTokenKey(user.id, sealed), () =>
    accessTokenFor(sealed, {
      decrypt: (stored) => decryptSecret(stored, env.TOKEN_ENCRYPTION_KEY),
      refresh: (refreshToken) =>
        refreshAccessToken({
          refreshToken,
          clientId: env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        }),
      forget: (stored) => clearRefreshToken(getDatabase(), user.id, stored),
    }),
  );
}

/**
 * Drop any Drive access token this instance is holding for the person, for use
 * when their Drive login is removed (account deletion) so a token cannot
 * outlive the connection it came from.
 */
export function forgetAccessTokens(userId: number): void {
  accessTokens.forgetUser(userId);
}
