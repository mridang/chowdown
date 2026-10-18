/**
 * OAuth callback. Validates the `state`, exchanges the code for tokens, loads
 * the user's identity, upserts the user (sealing the refresh token), ensures
 * their app-managed "Recipes" folder exists, issues the session cookie, and
 * sends them to `/app`. Any failure sends them home with an error flag rather
 * than leaking details.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getUserAccessToken } from '@/lib/auth/current-user';
import { RETURN_COOKIE, safeReturnPath } from '@/lib/auth/return-to';
import { exchangeCode, getUserInfo } from '@/lib/auth/google-oauth';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from '@/lib/auth/session';
import { encryptSecret } from '@/lib/crypto';
import { setRecipesFolderId, upsertUser } from '@/lib/db/users';
import { ensureRecipesFolder } from '@/lib/drive/drive-client';
import { appOrigin, getDatabase, getEnv } from '@/lib/util';

const STATE_COOKIE = 'chowdown_oauth_state';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const secure = origin.startsWith('https');
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  // Validate the round-trip before trusting the code.
  if (!code || !state || !expectedState || state !== expectedState) {
    console.error('[auth callback] state check failed', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasExpected: Boolean(expectedState),
      match: state === expectedState,
      oauthError: url.searchParams.get('error'),
    });
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  try {
    const tokens = await exchangeCode({
      code,
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: `${origin}/api/auth/callback`,
    });
    const info = await getUserInfo(tokens.access_token);

    const db = getDatabase();
    const refreshEnc = tokens.refresh_token
      ? await encryptSecret(tokens.refresh_token, env.TOKEN_ENCRYPTION_KEY)
      : undefined;
    const user = await upsertUser(db, {
      google_sub: info.sub,
      email: info.email,
      name: info.name,
      picture: info.picture,
      refresh_token_enc: refreshEnc,
    });

    // Create the Recipes folder on first sign-in (uses the fresh access token
    // directly rather than a refresh round-trip).
    if (!user.recipes_folder_id) {
      const folderId = await ensureRecipesFolder(tokens.access_token);
      await setRecipesFolderId(db, user.id, folderId);
    } else if (!tokens.refresh_token) {
      // Returning user on a silent grant: make sure we can still mint tokens.
      await getUserAccessToken(user);
    }

    const sessionToken = await createSessionToken(
      {
        uid: user.id,
        email: user.email,
        name: user.name ?? undefined,
        picture: user.picture ?? undefined,
      },
      env.SESSION_SECRET,
    );
    const returnTo = safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value);
    const response = NextResponse.redirect(`${origin}${returnTo ?? '/app'}`);
    response.cookies.delete(RETURN_COOKIE);
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    console.error(
      '[auth callback] failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return NextResponse.redirect(`${origin}/?error=auth`);
  }
}
