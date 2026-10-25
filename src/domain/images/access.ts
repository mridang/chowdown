/**
 * @packageDocumentation
 *
 * Which pictures a person may ask the proxy for. The proxy fetches pictures
 * from other websites, so left open to any address it would be a free image
 * relay for the whole web. Here only signed-in people may use it, and only for
 * the photos their own recipes list in `>> images:`, which is exactly the set
 * the pages ever ask for. (The edge keeps a copy of each photo, so the check
 * runs only when it has none.)
 */

import { problems } from '@/lib/core/api';
import { getSessionUid } from '@/lib/core/auth/current-user';
import { getDatabase } from '@/domain/db/client';
import { userHasCover } from '@/domain/images/cover-ownership';

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

/** Whether one of the signed-in person's recipes lists the photo at `url`. */
export async function mayFetch(url: string): Promise<boolean> {
  const uid = await getSessionUid();
  return uid !== null && userHasCover(getDatabase(), uid, url);
}
