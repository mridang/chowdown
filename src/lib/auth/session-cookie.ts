/**
 * @packageDocumentation
 *
 * Writing the signed session cookie onto a response, from a user record. Used
 * wherever the session is (re)issued: signing in, connecting Drive, and the
 * connect route noticing the cookie's Drive flag is out of date.
 */

import type { NextResponse } from 'next/server';

import type { User } from '../db/users';
import { isDriveConnected } from './drive-access';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from './session';

/**
 * Set a fresh session cookie for `user` on `response`. `drive` overrides what
 * the record says, for the moment Drive has just been connected and `user` is
 * the row from before.
 */
export async function setSessionCookie(
  response: NextResponse,
  user: User,
  options: { secret: string; secure: boolean; drive?: boolean },
): Promise<void> {
  const token = await createSessionToken(
    {
      uid: user.id,
      email: user.email,
      name: user.name ?? undefined,
      picture: user.picture ?? undefined,
      drive: options.drive ?? isDriveConnected(user),
    },
    options.secret,
  );
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}
