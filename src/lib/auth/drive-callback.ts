/**
 * @packageDocumentation
 *
 * Connecting Drive, the one ask besides signing in that a Google round trip can
 * be for. It runs for someone already signed in: it confirms the Google account
 * that approved is the signed-in one, that Drive was actually granted (Google
 * lets people untick it), seals the refresh token, makes sure the app-managed
 * "Recipes" folder exists and refreshes the session.
 */

import type { NextResponse } from 'next/server';

import { encryptSecret } from '@/lib/crypto';
import {
  getUserById,
  setRecipesFolderId,
  setRefreshToken,
} from '@/lib/db/users';
import { ensureRecipesFolder } from '@/lib/google/drive';
import { getDatabase } from '@/core/runtime';
import { logError } from '@/utils/logging';
import {
  LANDING_PATH,
  SESSION_COOKIE,
  SIGN_IN_FAILED_PATH,
  sessionClaims,
} from '@/lib/auth/app';
import { driveResultPath } from '@/lib/auth/drive-access';
import { checkDriveGrant } from '@/lib/auth/drive-grant';
import { finishFlow } from '@/core/auth/flow-cookies';
import type { GoogleUser, TokenResponse } from '@/lib/google/auth';
import { sessionIsCurrent, verifySessionToken } from '@/lib/session';
import { setSessionCookie } from '@/core/auth/session-cookie';
import type { FlowContext } from '@/lib/auth/sign-in';

/**
 * Finish connecting Drive: only for the person who is signed in, and only if
 * the Google account that just approved is theirs.
 */
export async function completeDriveConnect(
  { request, env, origin, returnTo }: FlowContext,
  info: GoogleUser,
  tokens: TokenResponse,
): Promise<NextResponse> {
  const db = getDatabase();
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value ?? '',
    env.SESSION_SECRET,
  );
  const found = session ? await getUserById(db, session.uid) : undefined;
  // A session the person has since ended (signed out everywhere) cannot be
  // used to attach a Drive login to the account.
  const user =
    session && found && sessionIsCurrent(session, found.session_epoch)
      ? found
      : undefined;
  if (!user) {
    return finishFlow(origin, SIGN_IN_FAILED_PATH);
  }
  const grant = checkDriveGrant({
    approvedBy: info.sub,
    signedInAs: user.google_sub,
    tokens,
  });
  if (!grant.ok) {
    if (grant.log) {
      logError({ event: 'auth.drive_grant_rejected', detail: grant.log });
    }
    return finishFlow(origin, driveResultPath(grant.result));
  }
  // The fresh access token is used directly (no refresh round trip). The
  // folder comes first so a failure here leaves nothing half-connected.
  const recipesFolderId =
    user.recipes_folder_id ?? (await ensureRecipesFolder(tokens.access_token));
  if (!user.recipes_folder_id) {
    await setRecipesFolderId(db, user.id, recipesFolderId);
  }
  await setRefreshToken(
    db,
    user.id,
    await encryptSecret(grant.refreshToken, env.TOKEN_ENCRYPTION_KEY),
  );
  const response = finishFlow(origin, returnTo ?? LANDING_PATH);
  // `user` is the row from before the folder existed: the cookie needs the new id.
  await setSessionCookie(response, user, {
    secret: env.SESSION_SECRET,
    secure: origin.startsWith('https'),
    claims: sessionClaims(
      { ...user, recipes_folder_id: recipesFolderId },
      true,
    ),
    exp: session?.exp,
  });
  return response;
}
