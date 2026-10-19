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

import { finishFlow } from '@/lib/auth/flow-cookies';
import { checkDriveGrant } from '@/lib/auth/drive-grant';
import {
  exchangeCode,
  getUserInfo,
  type AuthPurpose,
  type GoogleUser,
  type TokenResponse,
} from '@/lib/auth/google-oauth';
import { checkState, STATE_COOKIE } from '@/lib/auth/oauth-state';
import {
  driveResultPath,
  RETURN_COOKIE,
  safeReturnPath,
} from '@/lib/auth/return-to';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { encryptSecret } from '@/lib/crypto';
import type { Database } from '@/lib/db/client';
import {
  getUserById,
  setRecipesFolderId,
  setRefreshToken,
  upsertUser,
} from '@/lib/db/users';
import { ensureRecipesFolder } from '@/lib/drive/drive-client';
import { appOrigin, getDatabase, getEnv } from '@/lib/util';

/** Where a round trip stands: who is asking, and where it came from. */
interface Callback {
  readonly request: NextRequest;
  readonly env: CloudflareEnv;
  /** This site's public origin. */
  readonly origin: string;
  /** Where to land afterwards, from the cookie set when the trip began. */
  readonly returnTo: string | undefined;
}

/** Where to send someone whose round trip failed, by what it was for. */
function failurePath(purpose: AuthPurpose): string {
  return purpose === 'drive' ? driveResultPath('error') : '/?error=auth';
}

/** Finish a sign-in: record the person, issue their session and send them on. */
async function completeSignIn(
  { env, origin, returnTo }: Callback,
  info: GoogleUser,
  db: Database,
): Promise<NextResponse> {
  if (!info.email) {
    // Signing in asked for the email scope, so Google not sharing one is a
    // failed sign-in, not an account without an address.
    throw new Error('Google did not share an email address');
  }
  const user = await upsertUser(db, {
    google_sub: info.sub,
    email: info.email,
    name: info.name,
    picture: info.picture,
  });
  const response = finishFlow(origin, returnTo ?? '/app');
  await setSessionCookie(response, user, {
    secret: env.SESSION_SECRET,
    secure: origin.startsWith('https'),
  });
  return response;
}

/**
 * Finish connecting Drive: only for the person who is signed in, and only if
 * the Google account that just approved is theirs.
 */
async function completeDriveConnect(
  { request, env, origin, returnTo }: Callback,
  info: GoogleUser,
  tokens: TokenResponse,
  db: Database,
): Promise<NextResponse> {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value ?? '',
    env.SESSION_SECRET,
  );
  const user = session ? await getUserById(db, session.uid) : undefined;
  if (!user) {
    return finishFlow(origin, '/?error=auth');
  }
  const grant = checkDriveGrant({
    approvedBy: info.sub,
    signedInAs: user.google_sub,
    tokens,
  });
  if (!grant.ok) {
    if (grant.log) {
      console.error(grant.log);
    }
    return finishFlow(origin, driveResultPath(grant.result));
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
    await encryptSecret(grant.refreshToken, env.TOKEN_ENCRYPTION_KEY),
  );
  const response = finishFlow(origin, returnTo ?? '/app');
  await setSessionCookie(response, user, {
    secret: env.SESSION_SECRET,
    secure: origin.startsWith('https'),
    drive: true,
    exp: session?.exp,
  });
  return response;
}

/**
 * `GET /api/auth/callback`: where Google sends the browser back after sign-in
 * or Drive consent. Open to everyone, but only a request whose `state` matches
 * the cookie set when the trip began is acted on. Always answers a redirect: on
 * to the app on success, or back with a fixed flag (`/?error=auth`, or
 * `/app?drive=denied|error`) on any failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const origin = appOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const oauthError = url.searchParams.get('error');

  // Validate the round-trip before trusting the code.
  const checked = checkState(state, expectedState);
  if (!checked.ok) {
    console.error('[auth callback] state check failed', {
      hasState: Boolean(state),
      hasExpected: Boolean(expectedState),
      match: state === expectedState,
      oauthError,
    });
    // Leave the cookies alone: a stray or forged request must not be able to
    // wipe the state of a sign-in that is genuinely in flight. The label in the
    // value is only used to pick the wording, never trusted.
    return NextResponse.redirect(
      `${origin}${checked.claimed === 'drive' ? driveResultPath('error') : '/?error=auth'}`,
    );
  }
  const { purpose } = checked;
  // Closed the Google window or pressed Cancel.
  if (!code) {
    console.error('[auth callback] no code', { purpose, oauthError });
    return finishFlow(
      origin,
      purpose === 'drive' ? driveResultPath('denied') : '/?error=auth',
    );
  }

  const callback: Callback = {
    request,
    env,
    origin,
    returnTo: safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value),
  };
  try {
    const tokens = await exchangeCode({
      code,
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: `${origin}/api/auth/callback`,
    });
    const info = await getUserInfo(tokens.access_token);
    const db = getDatabase();
    return purpose === 'signin'
      ? await completeSignIn(callback, info, db)
      : await completeDriveConnect(callback, info, tokens, db);
  } catch (err) {
    console.error(
      '[auth callback] failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return finishFlow(origin, failurePath(purpose));
  }
}
