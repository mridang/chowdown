/**
 * Start the Google sign-in flow. Signing in asks Google for identity only;
 * connecting Drive is a separate step (`/api/auth/drive`). Generates a one-time
 * `state`, stores it in a short-lived httpOnly cookie for the callback to
 * validate (CSRF protection), and redirects the browser to Google's consent
 * screen.
 */

import { NextRequest, NextResponse } from 'next/server';

import { startFlowCookies } from '@/lib/auth/flow-cookies';
import { buildAuthUrl } from '@/lib/auth/google-oauth';
import { newState } from '@/lib/auth/oauth-state';
import { safeReturnPath } from '@/lib/auth/return-to';
import { getEnv } from '@/lib/util';
import { appOrigin } from '@/lib/util/origin';

/**
 * `GET /api/auth/login`: send the browser to Google to sign in. Open to
 * everyone. Answers a redirect to Google's consent screen, with the one-time
 * `state` and the safe `?returnTo=` path (if any) kept in short-lived cookies.
 */
export function GET(request: NextRequest): NextResponse {
  const origin = appOrigin(request);
  const state = newState('signin');
  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId: getEnv().GOOGLE_OAUTH_CLIENT_ID,
      redirectUri: `${origin}/api/auth/callback`,
      state,
      purpose: 'signin',
    }),
  );
  // Remember where to land afterwards (e.g. back on an assistant's approval
  // screen), but only if it is a path on this site.
  startFlowCookies(response, {
    state,
    returnTo: safeReturnPath(request.nextUrl.searchParams.get('returnTo')),
    secure: origin.startsWith('https'),
  });
  return response;
}
