/**
 * Bring the session cookie up to date with the database (today: whether Google
 * Drive is connected, which the header shows) and send the person back where
 * they were going. Pages can't change cookies, so one that notices the two
 * disagree redirects here. Someone not signed in goes home.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, getSession } from '@/lib/auth/current-user';
import { safeReturnPath } from '@/lib/auth/return-to';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { appOrigin, getEnv } from '@/lib/util';

/**
 * `GET /api/auth/refresh`: reissue the session cookie from the database and
 * send the person on to the safe `?returnTo=` path (or `/app`). Answers a
 * redirect; someone who is not signed in goes to the home page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = appOrigin(request);
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/`);
  }
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'));
  const response = NextResponse.redirect(`${origin}${returnTo ?? '/app'}`);
  await setSessionCookie(response, user, {
    secret: getEnv().SESSION_SECRET,
    secure: origin.startsWith('https'),
    // Correcting the hint must not lengthen the session: a copied cookie
    // could otherwise be kept alive for ever by calling this route.
    exp: (await getSession())?.exp,
  });
  return response;
}
