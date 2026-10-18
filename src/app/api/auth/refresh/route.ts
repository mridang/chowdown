/**
 * Bring the session cookie up to date with the database (today: whether Google
 * Drive is connected, which the header shows) and send the person back where
 * they were going. Pages can't change cookies, so one that notices the two
 * disagree redirects here. Someone not signed in goes home.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { safeReturnPath } from '@/lib/auth/return-to';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { appOrigin, getEnv } from '@/lib/util';

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
  });
  return response;
}
