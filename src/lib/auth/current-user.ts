/**
 * @packageDocumentation
 *
 * Server-side helpers to resolve the signed-in user and obtain a fresh Drive
 * access token for them. Used by Server Components (the `/app` auth gate) and
 * by the recipe API routes. Identity comes from the signed session cookie;
 * Drive access comes from the sealed refresh token in the database, exchanged
 * for a short-lived access token on demand.
 */

import { cookies } from 'next/headers';

import { refreshAccessToken } from './google-oauth';
import { SESSION_COOKIE, verifySessionToken } from './session';
import { decryptSecret } from '../crypto';
import { getUserById, type User } from '../db/users';
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
 * Exchange a user's stored refresh token for a fresh Drive access token.
 * Throws if the user has no refresh token (they must re-authenticate) — the
 * caller treats that as "send them back through login".
 */
export async function getUserAccessToken(user: User): Promise<string> {
  if (!user.refresh_token_enc) {
    throw new Error('No refresh token for user; re-authentication required');
  }
  const env = getEnv();
  const refreshToken = await decryptSecret(
    user.refresh_token_enc,
    env.TOKEN_ENCRYPTION_KEY,
  );
  const { access_token } = await refreshAccessToken({
    refreshToken,
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  return access_token;
}
