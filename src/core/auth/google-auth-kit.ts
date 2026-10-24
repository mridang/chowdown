/**
 * @packageDocumentation
 *
 * The framework-tier kit that turns the pure Google OAuth client and signed
 * sessions into the route handlers an app registers. It owns the shared
 * sign-in orchestration — build the consent URL and remember where to return
 * (login), validate the round trip and finish it (callback) — and leaves the
 * app's own choices (scopes, extra asks, what finishing sign-in does) to its
 * options. Adopting sign-in is then: configure a kit and register its handlers.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { GoogleOAuthClient } from '@/lib/google/auth';
import { problem } from '@/lib/rest-json/problem';
import {
  SIGN_IN_PURPOSE,
  checkState,
  newState,
} from '@/lib/web-security/oauth-state';
import { safeReturnPath } from '@/lib/web-security/return-to';
import { finishFlow, startFlowCookies } from '@/core/auth/flow-cookies';
import { appOrigin } from '@/core/origin';
import { RETURN_COOKIE, STATE_COOKIE } from '@/domain/auth/app';
import { getEnv } from '@/core/runtime';
import type { FlowContext, OtherFlow } from '@/domain/auth/sign-in';
import type { GoogleUser } from '@/lib/google/auth';
import { logError, logWarn } from '@/utils/logging';

/** How a Google sign-in kit is wired for one app. */
export interface GoogleAuthKitOptions {
  /** A Google OAuth client configured with the app's credentials (from env). */
  readonly oauthClient: () => GoogleOAuthClient;
  /** What signing in asks Google for. */
  readonly signInScopes: readonly string[];
  /** The path Google is sent back to (appended to the public origin). */
  readonly callbackPath: string;
  /** The names of any settings sign-in needs that are not set (empty when ready). */
  readonly missingSettings: () => readonly string[];
  /** The asks a round trip can be for besides signing in (the `state` labels). */
  readonly extraPurposes: readonly string[];
  /** How each of those asks finishes and where it sends failures. */
  readonly otherFlows: Readonly<Partial<Record<string, OtherFlow>>>;
  /** Where a failed sign-in lands, with a fixed flag rather than any detail. */
  readonly signInFailedPath: string;
  /** Finish a sign-in once the code has been exchanged. */
  readonly completeSignIn: (
    context: FlowContext,
    info: GoogleUser,
  ) => Promise<NextResponse>;
}

/**
 * A configured Google sign-in kit. Build it with {@link GoogleAuthKitOptions}
 * and register its handlers on the login and callback routes.
 */
export class GoogleAuthKit {
  readonly #options: GoogleAuthKitOptions;

  constructor(options: GoogleAuthKitOptions) {
    this.#options = options;
  }

  /** Where to send someone whose round trip failed, by what it was for. */
  #failurePath(purpose: string, kind: 'error' | 'denied'): string {
    return purpose === SIGN_IN_PURPOSE
      ? this.#options.signInFailedPath
      : (this.#options.otherFlows[purpose]?.failurePath(kind) ??
          this.#options.signInFailedPath);
  }

  /**
   * `GET /auth/login`: start the Google sign-in flow. Generates a one-time
   * `state`, stores it (and a safe `?returnTo=`) in short-lived cookies, and
   * redirects to Google's consent screen; 503 naming the missing settings when
   * the server is not set up for signing in.
   */
  loginHandler(): (request: NextRequest) => Response {
    return (request) => {
      const missing = this.#options.missingSettings();
      if (missing.length > 0) {
        logError({ event: 'auth.login.not_configured', missing });
        return problem(
          503,
          '/problems/not-configured',
          'Sign-in is not set up',
          `Sign-in is not set up on this server. Missing: ${missing.join(', ')}.`,
        );
      }
      const origin = appOrigin(request);
      const state = newState(SIGN_IN_PURPOSE);
      const response = NextResponse.redirect(
        this.#options.oauthClient().authUrl({
          redirectUri: `${origin}${this.#options.callbackPath}`,
          state,
          scopes: this.#options.signInScopes,
        }),
      );
      startFlowCookies(response, {
        state,
        returnTo: safeReturnPath(request.nextUrl.searchParams.get('returnTo')),
        secure: origin.startsWith('https'),
      });
      return response;
    };
  }

  /**
   * `GET /auth/callback`: where Google sends the browser back. Acts only on a
   * request whose `state` matches the cookie set when the trip began; always
   * answers a redirect — on to the app on success, or back with a fixed flag on
   * any failure.
   */
  callbackHandler(): (request: NextRequest) => Promise<Response> {
    return async (request) => {
      const origin = appOrigin(request);
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const expectedState = request.cookies.get(STATE_COOKIE)?.value;
      const oauthError = url.searchParams.get('error');

      const checked = checkState(
        state,
        expectedState,
        this.#options.extraPurposes,
      );
      if (!checked.ok) {
        logError({
          event: 'auth.callback.state_check_failed',
          hasState: Boolean(state),
          hasExpected: Boolean(expectedState),
          match: state === expectedState,
          oauthError,
        });
        return NextResponse.redirect(
          `${origin}${this.#failurePath(checked.claimed ?? SIGN_IN_PURPOSE, 'error')}`,
        );
      }
      const { purpose } = checked;
      if (!code) {
        logWarn({ event: 'auth.callback.no_code', purpose, oauthError });
        return finishFlow(origin, this.#failurePath(purpose, 'denied'));
      }
      const missing = this.#options.missingSettings();
      if (missing.length > 0) {
        logError({ event: 'auth.callback.not_configured', missing });
        return finishFlow(origin, this.#failurePath(purpose, 'error'));
      }

      const context: FlowContext = {
        request,
        env: getEnv(),
        origin,
        returnTo: safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value),
      };
      try {
        const google = this.#options.oauthClient();
        const tokens = await google.exchangeCode({
          code,
          redirectUri: `${origin}${this.#options.callbackPath}`,
        });
        const info = await google.getUserInfo(tokens.access_token);
        if (purpose === SIGN_IN_PURPOSE) {
          return await this.#options.completeSignIn(context, info);
        }
        const other = this.#options.otherFlows[purpose];
        if (!other) {
          throw new Error(`No flow is registered for "${purpose}"`);
        }
        return await other.complete(context, info, tokens);
      } catch (err) {
        logError({
          event: 'auth.callback.failed',
          error:
            err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
        return finishFlow(origin, this.#failurePath(purpose, 'error'));
      }
    };
  }
}
