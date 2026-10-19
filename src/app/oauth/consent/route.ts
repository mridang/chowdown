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
  authorizeParamsFrom,
  redirectWith,
  validateAuthorizeRequest,
} from '@/lib/oauth/authorize-request';
import { isSameOriginPost } from '@/lib/oauth/csrf';
import { issueAuthorizationCode } from '@/lib/oauth/token-endpoint';
import { appOrigin, getDatabase } from '@/lib/util';

/** A plain-text error page response, with a `Retry-After` when the caller should wait. */
const refuse = (
  message: string,
  status: number,
  retryAfterSeconds?: number,
): NextResponse =>
  new NextResponse(message, {
    status,
    headers:
      retryAfterSeconds === undefined
        ? undefined
        : { 'Retry-After': String(retryAfterSeconds) },
  });

/**
 * `POST /oauth/consent`: the decision from the approval screen. Needs a
 * signed-in browser and a same-origin form post. Answers 303 back to the app's
 * verified redirect address (with a `code` on approval, or an `error` when
 * cancelled or when the request has a problem after the address was checked),
 * 400 with a plain message when the client or redirect address cannot be
 * trusted or the form is unreadable, 401 when nobody is signed in, 403 for a
 * cross-site post and 429 when too many client metadata documents are being
 * fetched at the moment.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  if (!isSameOriginPost(request.headers, origin)) {
    return refuse('Cross-site request refused.', 403);
  }
  const uid = await getSessionUid();
  if (uid === null) {
    return refuse('Sign in first.', 401);
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return refuse('The form could not be read.', 400);
  }
  const db = getDatabase();
  const check = await validateAuthorizeRequest(
    authorizeParamsFrom(form),
    origin,
    (id) => resolveClient(db, id),
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
    return check.retryAfterSeconds === undefined
      ? refuse(check.description, 400)
      : refuse(check.description, 429, check.retryAfterSeconds);
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
