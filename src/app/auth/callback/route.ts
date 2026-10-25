/**
 * Google's way back into the app.
 *
 * Signing in: validates the `state`, exchanges the code, loads the identity,
 * records the user, issues the session cookie and sends them on (to the app's
 * landing page unless they came from somewhere specific).
 *
 * An app can have other asks that come back the same way (see `EXTRA_PURPOSES`
 * in `app.ts`); the `state` says which one this was, and the app's own flow
 * (see `hooks.ts`) finishes it.
 *
 * Any failure sends them back with a fixed flag rather than leaking details.
 */

import { authKit } from '@/domain/auth/kit';

/**
 * `GET /auth/callback`: where Google sends the browser back after consent.
 * Open to everyone, but only a request whose `state` matches the cookie set
 * when the trip began is acted on. Always answers a redirect: on to the app on
 * success, or back with a fixed flag on any failure.
 */
export const GET = authKit.callbackHandler();
