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

import { DriveNotConnectedError, isAuthFailure } from './drive-access';
import { refreshAccessToken } from './google-oauth';
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from './session';
import { decryptSecret } from '../crypto';
import { clearRefreshToken, getUserById, type User } from '../db/users';
import { getDatabase, getEnv } from '../util';

/**
 * The user for the current request, or null when not signed in or the session
 * is invalid/expired. Verifies the cookie signature before touching the DB.
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
  return (await getUserById(getDatabase(), payload.uid)) ?? null;
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

/** The signed-in user's id from the session cookie alone (see {@link getSession}). */
export async function getSessionUid(): Promise<number | null> {
  return (await getSession())?.uid ?? null;
}

/**
 * Exchange a user's stored refresh token for a fresh Drive access token.
 *
 * Throws {@link DriveNotConnectedError} if the user hasn't connected Drive, and
 * also when the stored login turns out to be unusable: Google rejected it
 * (expired or revoked) or it can't be unsealed (the key changed). In those
 * cases the token is cleared first, so the person is offered "reconnect"
 * everywhere rather than being stuck as "connected" with nothing working.
 * Other failures (a network blip) are rethrown untouched.
 */
export async function getUserAccessToken(user: User): Promise<string> {
  if (!user.refresh_token_enc) {
    throw new DriveNotConnectedError();
  }
  const env = getEnv();
  const sealed = user.refresh_token_enc;
  let refreshToken: string;
  try {
    refreshToken = await decryptSecret(sealed, env.TOKEN_ENCRYPTION_KEY);
  } catch {
    await clearRefreshToken(getDatabase(), user.id, sealed);
    throw new DriveNotConnectedError();
  }
  try {
    const { access_token } = await refreshAccessToken({
      refreshToken,
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    });
    return access_token;
  } catch (error) {
    if (isAuthFailure(error)) {
      await clearRefreshToken(getDatabase(), user.id, sealed);
      throw new DriveNotConnectedError();
    }
    throw error;
  }
}
