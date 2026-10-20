/**
 * @packageDocumentation
 *
 * What this app does at the edges of the shared sign-in flow (see `sign-in.ts`
 * and the callback route): after someone signs in, and for any ask a Google
 * round trip can be for besides signing in. Every app has this module with the
 * same exports; here, signing in has nothing more to do, and the one other ask
 * is connecting Google Drive (see `drive-callback.ts`).
 */

import { driveResultPath } from './drive-access';
import { completeDriveConnect } from './drive-callback';
import type { OtherFlow } from './sign-in';
import type { User } from './store';

/** What runs once the person is recorded and before their session is issued. */
export const afterSignIn: (user: Readonly<User>) => Promise<void> = async () =>
  undefined;

/** The asks besides signing in, by the purpose label in their `state` (see `EXTRA_PURPOSES` in `app.ts`). */
export const OTHER_FLOWS: Readonly<Partial<Record<string, OtherFlow>>> = {
  drive: { failurePath: driveResultPath, complete: completeDriveConnect },
};
