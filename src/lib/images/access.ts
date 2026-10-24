/**
 * @packageDocumentation
 *
 * Which pictures a person may ask the proxy for. The proxy fetches pictures
 * from other websites, so left open to any address it would be a free image
 * relay for the whole web. Here only signed-in people may use it, and only for
 * the photos their own recipes list in `>> images:` and the logos of the apps
 * they have connected, which is exactly the set the pages ever ask for. (The edge keeps a copy of each photo, so the check
 * runs only when it has none.)
 */

import { problems } from '../api/problem';
import { getSessionUid } from '../auth/current-user';
import { userHasConnectedLogo } from '../db/oauth';
import { getDatabase } from '../util';
import { userHasCover } from './cover-ownership';

/** Refuses a caller who is not signed in. */
export async function authenticate(): Promise<Response | undefined> {
  return (await getSessionUid()) === null ? problems.unauthorized() : undefined;
}

/** This app does not sign its picture addresses: who may ask is decided by `mayFetch`. */
export function signatureFor(): string | undefined {
  return undefined;
}

/** This app does not sign its picture addresses, so there is nothing to check. */
export function signatureValid(): boolean {
  return true;
}

/**
 * Whether `url` is a photo one of the signed-in person's recipes lists, or the
 * logo of an app they have connected.
 */
export async function mayFetch(url: string): Promise<boolean> {
  const uid = await getSessionUid();
  if (uid === null) {
    return false;
  }
  const db = getDatabase();
  return (
    (await userHasCover(db, uid, url)) ||
    (await userHasConnectedLogo(db, uid, url))
  );
}
