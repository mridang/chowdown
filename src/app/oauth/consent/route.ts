/**
 * Receives the Approve / Cancel decision from the consent screen. Everything is
 * validated again here (the form fields are untrusted), and the browser must be
 * signed in. Approving mints a single-use authorization code and sends the user
 * back to the app's redirect URI; cancelling sends back `access_denied`.
 */

import { NextResponse } from 'next/server';

import { getSessionUid } from '@/lib/auth/current-user';
import { createOAuthStore, resolveClient } from '@/lib/db/oauth';
import {
  redirectWith,
  validateAuthorizeRequest,
  type AuthorizeParams,
} from '@/lib/oauth/authorize-request';
import { isSameOriginPost } from '@/lib/oauth/csrf';
import { issueAuthorizationCode } from '@/lib/oauth/token-endpoint';
import { appOrigin, getDatabase } from '@/lib/util';

const PARAMS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'state',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'resource',
];

/** A plain-text error page response. */
const refuse = (message: string, status: number) =>
  new NextResponse(message, { status });

export async function POST(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  if (!isSameOriginPost(request.headers, origin)) {
    return refuse('Cross-site request refused.', 403);
  }
  const uid = await getSessionUid();
  if (uid === null) {
    return refuse('Sign in first.', 401);
  }

  const form = await request.formData();
  const params: AuthorizeParams = {};
  for (const name of PARAMS) {
    const value = form.get(name);
    if (typeof value === 'string') {
      params[name] = value;
    }
  }

  const db = getDatabase();
  const check = await validateAuthorizeRequest(params, origin, (id) =>
    resolveClient(db, id),
  );
  if (!check.ok) {
    // Only redirect when the redirect target was verified.
    if (check.redirect) {
      return NextResponse.redirect(
        redirectWith(check.redirect.uri, {
          error: check.error,
          error_description: check.description,
          state: check.redirect.state,
          iss: origin,
        }),
        303,
      );
    }
    return refuse(check.description, 400);
  }

  const { client, redirectUri, state, codeChallenge, scope, resource } =
    check.request;
  if (form.get('decision') !== 'approve') {
    return NextResponse.redirect(
      redirectWith(redirectUri, { error: 'access_denied', state, iss: origin }),
      303,
    );
  }

  const code = await issueAuthorizationCode(
    createOAuthStore(db),
    {
      clientId: client.clientId,
      userId: uid,
      redirectUri,
      codeChallenge,
      scope,
      resource,
    },
    Math.floor(Date.now() / 1000),
  );
  return NextResponse.redirect(
    redirectWith(redirectUri, { code, state, iss: origin }),
    303,
  );
}
