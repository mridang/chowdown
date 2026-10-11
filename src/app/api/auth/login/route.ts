/**
 * Start the Google sign-in flow. Generates a one-time `state`, stores it in a
 * short-lived httpOnly cookie for the callback to validate (CSRF protection),
 * and redirects the browser to Google's consent screen.
 */

import { NextRequest, NextResponse } from 'next/server';

import { buildAuthUrl } from '@/lib/auth/google-oauth';
import { appOrigin, getEnv } from '@/lib/util';

/** Name of the short-lived cookie holding the OAuth `state` value. */
const STATE_COOKIE = 'chowdown_oauth_state';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const state = crypto.randomUUID();
  const url = buildAuthUrl({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    redirectUri: `${origin}/api/auth/callback`,
    state,
  });
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
