/**
 * Start the Google sign-in flow. Signing in asks Google for identity only.
 * Generates a one-time `state`, stores it in a short-lived httpOnly cookie for
 * the callback to validate (CSRF protection), and redirects the browser to
 * Google's consent screen. Refuses, saying what is missing, when the server is
 * not set up for signing in: it never falls back to a made-up secret.
 */

import { authKit } from '@/domain/auth/kit';

/**
 * `GET /auth/login`: send the browser to Google to sign in. Open to everyone.
 * Answers a redirect to Google's consent screen, with the one-time `state` and
 * the safe `?returnTo=` path (if any) kept in short-lived cookies, or 503
 * naming the settings that are missing.
 */
export const GET = authKit.loginHandler();
