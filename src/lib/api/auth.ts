/**
 * @packageDocumentation
 *
 * Who is calling the REST API. The browser app authenticates with its signed
 * session cookie. Because a cookie is sent automatically, requests that change
 * data must also come from our own pages: the browser reports where a request
 * came from in `Sec-Fetch-Site`, and anything not same-origin is refused.
 */

import type { NextResponse } from 'next/server';

import { getCurrentUser, getSessionUid } from '../auth/current-user';
import type { User } from '../db/users';
import { isSameOriginPost } from '../oauth/csrf';
import { appOrigin } from '../util';
import { problems } from './problem';

/** Methods that never change data and so need no origin check. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Refuse cross-site requests that would change data. */
function crossSite(request: Request): boolean {
  return (
    !SAFE_METHODS.has(request.method) &&
    !isSameOriginPost(request.headers, appOrigin(request))
  );
}

/** Success carries the caller; failure carries the response to send back. */
export type Auth<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

/**
 * The caller's user id, from the signed cookie alone (no database read).
 * Enough for anything that only scopes queries by user.
 */
export async function requireUid(request: Request): Promise<Auth<number>> {
  if (crossSite(request)) {
    return {
      ok: false,
      response: problems.forbidden('Cross-site requests are not allowed.'),
    };
  }
  const uid = await getSessionUid();
  return uid === null
    ? { ok: false, response: problems.unauthorized() }
    : { ok: true, value: uid };
}

/** The caller's full user record, for routes that need Drive access. */
export async function requireUser(request: Request): Promise<Auth<User>> {
  if (crossSite(request)) {
    return {
      ok: false,
      response: problems.forbidden('Cross-site requests are not allowed.'),
    };
  }
  const user = await getCurrentUser();
  return user
    ? { ok: true, value: user }
    : { ok: false, response: problems.unauthorized() };
}
