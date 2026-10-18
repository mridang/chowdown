/**
 * @packageDocumentation
 *
 * Who the page header should greet. It comes from the signed session cookie, so
 * the common case costs no database read; only a session issued before names
 * and photos were stored in it falls back to one lookup (cached for the
 * request), and gets the full profile at the next sign-in.
 */

import { cookies } from 'next/headers';
import { cache } from 'react';

import { getUserById } from '../db/users';
import { getDatabase, getEnv } from '../util';
import { SESSION_COOKIE, verifySessionToken } from './session';

/** What the header shows about the signed-in person. */
export interface ShellUser {
  /** Their first name, for "Hi Mridang". */
  firstName: string;
  /** Their full name, if Google gave one. */
  name: string;
  email: string;
  /** Their Google profile photo, if any. */
  picture?: string;
}

/** The first word of a name, or the part of an email before the "@". */
export function firstNameOf(name: string | null | undefined, email: string) {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || email.split('@')[0] || email;
}

/** The signed-in person for the header, or null when signed out. */
export const getShellUser = cache(async (): Promise<ShellUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const payload = await verifySessionToken(token, getEnv().SESSION_SECRET);
  if (!payload) {
    return null;
  }
  let { name, picture } = payload;
  if (name === undefined && picture === undefined) {
    try {
      const user = await getUserById(getDatabase(), payload.uid);
      name = user?.name ?? undefined;
      picture = user?.picture ?? undefined;
    } catch {
      // The header can do without a photo.
    }
  }
  return {
    firstName: firstNameOf(name, payload.email),
    name: name ?? payload.email,
    email: payload.email,
    picture,
  };
});
