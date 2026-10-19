/**
 * @packageDocumentation
 *
 * Who the page header should greet. It comes from the signed session cookie, so
 * the common case costs no database read; only a session issued before names,
 * photos and the Drive flag were stored in it falls back to one lookup (cached
 * for the request), and gets the full profile at the next sign-in.
 */

import { cookies } from 'next/headers';
import { cache } from 'react';

import { getUserById } from '../db/users';
import { getDatabase, getEnv } from '../util';
import { isDriveConnected } from './drive-access';
import { SESSION_COOKIE, verifySessionToken } from './session';

/** What the header shows about the signed-in person. */
export interface ShellUser {
  /** Their first name, for "Hi Mridang". */
  readonly firstName: string;
  /** Their full name, if Google gave one. */
  readonly name: string;
  readonly email: string;
  /** Their Google profile photo, if any. */
  readonly picture?: string;
  /** Whether they have connected Google Drive (a hint; pages check for real). */
  readonly driveConnected: boolean;
}

/** The first word of a name, or the part of an email before the "@". */
export function firstNameOf(
  name: string | null | undefined,
  email: string,
): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || email.split('@')[0] || email;
}

/** What the session token says about the person's profile, any of which may be missing. */
interface Profile {
  readonly name?: string;
  readonly picture?: string;
  readonly drive?: boolean;
}

/**
 * Fill the gaps in a profile from the database. A session issued before
 * names, photos and the Drive flag were stored in it lacks some of them; one
 * lookup supplies what is missing. If the lookup fails the profile is used
 * as it is: the header can do without a photo, and offers the connection if
 * unsure.
 */
async function completeProfile(
  profile: Profile,
  uid: number,
): Promise<Profile> {
  const { name, picture, drive } = profile;
  if (drive !== undefined && (name !== undefined || picture !== undefined)) {
    return profile;
  }
  try {
    const user = await getUserById(getDatabase(), uid);
    return {
      name: name ?? user?.name ?? undefined,
      picture: picture ?? user?.picture ?? undefined,
      drive: drive ?? (user ? isDriveConnected(user) : false),
    };
  } catch {
    return profile;
  }
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
  const { name, picture, drive } = await completeProfile(payload, payload.uid);
  return {
    firstName: firstNameOf(name, payload.email),
    name: name ?? payload.email,
    email: payload.email,
    picture,
    driveConnected: drive === true,
  };
});
