/**
 * Google's way back into the app, for both asks.
 *
 * Signing in: validates the `state`, exchanges the code, loads the identity,
 * upserts the user, issues the session cookie and sends them on (to `/app`
 * unless they came from somewhere specific). No Drive access is involved.
 *
 * Connecting Drive: the same checks, for someone already signed in. It confirms
 * the Google account that approved is the signed-in one, that Drive was
 * actually granted (Google lets people untick it), seals the refresh token,
 * makes sure the app-managed "Recipes" folder exists and refreshes the session.
 *
 * Any failure sends them back with a fixed flag rather than leaking details.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeCode,
  getUserInfo,
  grantedDrive,
  type AuthPurpose,
} from '@/lib/auth/google-oauth';
import { purposeOf, STATE_COOKIE } from '@/lib/auth/oauth-state';
import {
  driveResultPath,
  RETURN_COOKIE,
  safeReturnPath,
} from '@/lib/auth/return-to';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { encryptSecret } from '@/lib/crypto';
import {
  getUserById,
  setRecipesFolderId,
  setRefreshToken,
  upsertUser,
} from '@/lib/db/users';
import { ensureRecipesFolder } from '@/lib/drive/drive-client';
import { appOrigin, getDatabase, getEnv } from '@/lib/util';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const secure = origin.startsWith('https');
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const purpose: AuthPurpose | undefined = state ? purposeOf(state) : undefined;
  const returnTo = safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value);
  const oauthError = url.searchParams.get('error');

  /** Back to where they were going, with the one-time cookies cleared. */
  const finish = (path: string): NextResponse => {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.delete(RETURN_COOKIE);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  // Validate the round-trip before trusting the code.
  if (!state || !expectedState || state !== expectedState || !purpose) {
    console.error('[auth callback] state check failed', {
      hasState: Boolean(state),
      hasExpected: Boolean(expectedState),
      match: state === expectedState,
      oauthError,
    });
    // Leave the cookies alone: a stray or forged request must not be able to
    // wipe the state of a sign-in that is genuinely in flight. The label in the
    // value is only used to pick the wording, never trusted.
    const label = state ? purposeOf(state) : undefined;
    return NextResponse.redirect(
      `${origin}${label === 'drive' ? driveResultPath('error') : '/?error=auth'}`,
    );
  }
  // Closed the Google window or pressed Cancel.
  if (!code) {
    console.error('[auth callback] no code', { purpose, oauthError });
    return finish(
      purpose === 'drive' ? driveResultPath('denied') : '/?error=auth',
    );
  }

  const redirectUri = `${origin}/api/auth/callback`;
  try {
    const tokens = await exchangeCode({
      code,
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri,
    });
    const info = await getUserInfo(tokens.access_token);
    const db = getDatabase();

    if (purpose === 'signin') {
      const user = await upsertUser(db, {
        google_sub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture,
      });
      const response = finish(returnTo ?? '/app');
      await setSessionCookie(response, user, {
        secret: env.SESSION_SECRET,
        secure,
      });
      return response;
    }

    // Connecting Drive: only for the person who is signed in, and only if the
    // Google account that just approved is theirs.
    const session = await verifySessionToken(
      request.cookies.get(SESSION_COOKIE)?.value ?? '',
      env.SESSION_SECRET,
    );
    const user = session ? await getUserById(db, session.uid) : undefined;
    if (!user) {
      return finish('/?error=auth');
    }
    if (info.sub !== user.google_sub) {
      console.error('[auth callback] drive grant from a different account');
      return finish(driveResultPath('error'));
    }
    if (!grantedDrive(tokens.scope)) {
      // They unticked the Drive permission.
      return finish(driveResultPath('denied'));
    }
    if (!tokens.refresh_token) {
      console.error('[auth callback] drive grant carried no refresh token');
      return finish(driveResultPath('error'));
    }
    // The fresh access token is used directly (no refresh round trip). The
    // folder comes first so a failure here leaves nothing half-connected.
    if (!user.recipes_folder_id) {
      await setRecipesFolderId(
        db,
        user.id,
        await ensureRecipesFolder(tokens.access_token),
      );
    }
    await setRefreshToken(
      db,
      user.id,
      await encryptSecret(tokens.refresh_token, env.TOKEN_ENCRYPTION_KEY),
    );
    const response = finish(returnTo ?? '/app');
    await setSessionCookie(response, user, {
      secret: env.SESSION_SECRET,
      secure,
      drive: true,
    });
    return response;
  } catch (err) {
    console.error(
      '[auth callback] failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return finish(
      purpose === 'drive' ? driveResultPath('error') : '/?error=auth',
    );
  }
}
