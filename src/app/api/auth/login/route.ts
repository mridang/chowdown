/**
 * Start the Google sign-in flow. Signing in asks Google for identity only;
 * connecting Drive is a separate step (`/api/auth/drive`). Generates a one-time
 * `state`, stores it in a short-lived httpOnly cookie for the callback to
 * validate (CSRF protection), and redirects the browser to Google's consent
 * screen.
 */

import { NextRequest, NextResponse } from 'next/server';

import { buildAuthUrl } from '@/lib/auth/google-oauth';
import {
  newState,
  STATE_COOKIE,
  STATE_TTL_SECONDS,
} from '@/lib/auth/oauth-state';
import { RETURN_COOKIE, safeReturnPath } from '@/lib/auth/return-to';
import { appOrigin, getEnv } from '@/lib/util';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const state = newState('signin');
  const url = buildAuthUrl({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    redirectUri: `${origin}/api/auth/callback`,
    state,
    purpose: 'signin',
  });
  const response = NextResponse.redirect(url);
  const cookie = {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  } as const;
  response.cookies.set(STATE_COOKIE, state, cookie);
  // Remember where to land afterwards (e.g. back on an assistant's approval
  // screen), but only if it is a path on this site.
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'));
  if (returnTo) {
    response.cookies.set(RETURN_COOKIE, returnTo, cookie);
  } else {
    // Don't let an abandoned earlier attempt send them somewhere stale.
    response.cookies.delete(RETURN_COOKIE);
  }
  return response;
}
