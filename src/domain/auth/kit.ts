/**
 * @packageDocumentation
 *
 * chowdown's Google sign-in kit: the {@link GoogleAuthKit} wired with this
 * app's credentials, scopes, extra asks (connecting Drive) and what finishing a
 * sign-in does. The login and callback routes register its handlers.
 */

import { GoogleAuthKit } from '@/core/auth/google-auth-kit';
import { GoogleOAuthClient, SIGN_IN_SCOPES } from '@/lib/google';
import { getEnv } from '@/core/runtime';
import { EXTRA_PURPOSES, SIGN_IN_FAILED_PATH } from '@/domain/auth/app';
import { OTHER_FLOWS } from '@/core/auth/hooks';
import { completeSignIn, missingSignInSettings } from '@/domain/auth/sign-in';

/** The sign-in kit for this app, registered by the login and callback routes. */
export const authKit = new GoogleAuthKit({
  oauthClient: () =>
    new GoogleOAuthClient({
      clientId: getEnv().GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: getEnv().GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  signInScopes: SIGN_IN_SCOPES,
  callbackPath: '/auth/callback',
  missingSettings: () => missingSignInSettings(getEnv()),
  extraPurposes: EXTRA_PURPOSES,
  otherFlows: OTHER_FLOWS,
  signInFailedPath: SIGN_IN_FAILED_PATH,
  completeSignIn,
});
