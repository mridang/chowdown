/**
 * @packageDocumentation
 *
 * Who is calling the REST API. The browser app authenticates with its signed
 * session cookie. Because a cookie is sent automatically, requests that change
 * data must also come from our own pages: the browser reports where a request
 * came from in `Sec-Fetch-Site`, and anything not same-origin is refused.
 */

import type { NextResponse } from 'next/server';

import {
  getCurrentUser,
  getLiveSessionUid,
  getSessionUid,
} from '@/lib/auth/current-user';
import type { User } from '@/lib/db/users';
import { isSameOriginPost } from '@/lib/auth/csrf';
import { appOrigin } from '@/lib/util/origin';
import { problems } from '@/lib/api/problem';

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
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: NextResponse };

/**
 * Run the cross-site check, then `identify`: 403 for a cross-site write, 401
 * when `identify` finds nobody (it answers null), otherwise the caller. The
 * 403 comes first so a forged request learns nothing about who is signed in.
 */
async function authenticate<T>(
  request: Request,
  identify: () => Promise<T | null>,
): Promise<Auth<T>> {
  if (crossSite(request)) {
    return {
      ok: false,
      response: problems.forbidden('Cross-site requests are not allowed.'),
    };
  }
  const caller = await identify();
  return caller === null
    ? { ok: false, response: problems.unauthorized() }
    : { ok: true, value: caller };
}

/**
 * The caller's user id, from the signed cookie alone (no database read).
 * Enough for anything that only scopes queries by user, but it cannot tell that
 * the person has since signed out everywhere: use {@link requireLiveUid} (or
 * {@link requireUser}) wherever that matters.
 */
export async function requireUid(request: Request): Promise<Auth<number>> {
  return authenticate(request, getSessionUid);
}

/**
 * The caller's user id, after confirming with one small database read that the
 * session has not been ended and the account still exists. For routes that
 * only need the id but must honour "sign out everywhere".
 */
export async function requireLiveUid(request: Request): Promise<Auth<number>> {
  return authenticate(request, getLiveSessionUid);
}

/** The caller's full user record, for routes that need Drive access. */
export async function requireUser(request: Request): Promise<Auth<User>> {
  return authenticate(request, getCurrentUser);
}
