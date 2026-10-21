/**
 * Start connecting Google Drive, a step of its own after signing in. Asks
 * Google for the one Drive permission chowdown uses (files the app creates)
 * and a refresh token, for the account that is already signed in. Someone not
 * signed in is sent to sign in first and brought straight back here. Someone
 * already connected (say on another device, so this browser's header is out of
 * date) is not sent to Google at all: their session is refreshed and they go on
 * (unless `?force=1`, from a page that has found the stored login unusable).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, getSession } from '@/lib/auth/current-user';
import { isDriveConnected } from '@/lib/auth/drive-access';
import { buildDriveAuthUrl } from '@/lib/auth/drive-oauth';
import { startFlowCookies } from '@/lib/auth/flow-cookies';
import { newState } from '@/lib/auth/oauth-state';
import { safeReturnPath } from '@/lib/auth/return-to';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { getEnv } from '@/lib/util';
import { appOrigin } from '@/lib/util/origin';

/**
 * `GET /auth/drive`: connect Google Drive for the signed-in person.
 * Answers a redirect: to sign-in first when nobody is signed in, straight on
 * (with a corrected session cookie) when Drive is already connected, or to
 * Google's consent screen otherwise.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const secure = origin.startsWith('https');
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'));

  const user = await getCurrentUser();
  if (!user) {
    const here = `/auth/drive${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
    return NextResponse.redirect(
      `${origin}/auth/login?returnTo=${encodeURIComponent(here)}`,
    );
  }

  const force = request.nextUrl.searchParams.get('force') === '1';
  if (isDriveConnected(user) && !force) {
    const response = NextResponse.redirect(`${origin}${returnTo ?? '/app'}`);
    await setSessionCookie(response, user, {
      secret: env.SESSION_SECRET,
      secure,
      // Same lifetime as before: this only corrects the hint.
      exp: (await getSession())?.exp,
    });
    return response;
  }

  const state = newState('drive');
  const response = NextResponse.redirect(
    buildDriveAuthUrl({
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      redirectUri: `${origin}/auth/callback`,
      state,
      loginHint: user.email,
    }),
  );
  startFlowCookies(response, { state, returnTo, secure });
  return response;
}
