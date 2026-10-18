/**
 * Start connecting Google Drive, a step of its own after signing in. Asks
 * Google for the one Drive permission chowdown uses (files the app creates)
 * and a refresh token, for the account that is already signed in. Someone not
 * signed in is sent to sign in first and brought straight back here. Someone
 * already connected (say on another device, so this browser's header is out of
 * date) is not sent to Google at all: their session is refreshed and they go on.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { isDriveConnected } from '@/lib/auth/drive-access';
import { buildAuthUrl } from '@/lib/auth/google-oauth';
import {
  newState,
  STATE_COOKIE,
  STATE_TTL_SECONDS,
} from '@/lib/auth/oauth-state';
import { RETURN_COOKIE, safeReturnPath } from '@/lib/auth/return-to';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { appOrigin, getEnv } from '@/lib/util';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'));

  const user = await getCurrentUser();
  if (!user) {
    const here = `/api/auth/drive${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
    return NextResponse.redirect(
      `${origin}/api/auth/login?returnTo=${encodeURIComponent(here)}`,
    );
  }

  if (isDriveConnected(user)) {
    const response = NextResponse.redirect(`${origin}${returnTo ?? '/app'}`);
    await setSessionCookie(response, user, {
      secret: env.SESSION_SECRET,
      secure: origin.startsWith('https'),
    });
    return response;
  }

  const state = newState('drive');
  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      redirectUri: `${origin}/api/auth/callback`,
      state,
      purpose: 'drive',
      loginHint: user.email,
    }),
  );
  const cookie = {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  } as const;
  response.cookies.set(STATE_COOKIE, state, cookie);
  if (returnTo) {
    response.cookies.set(RETURN_COOKIE, returnTo, cookie);
  } else {
    // Don't let an abandoned earlier attempt send them somewhere stale.
    response.cookies.delete(RETURN_COOKIE);
  }
  return response;
}
