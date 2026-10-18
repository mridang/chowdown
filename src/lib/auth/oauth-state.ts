/**
 * @packageDocumentation
 *
 * The one-time `state` value of a Google round trip. It does two jobs: it is the
 * CSRF check (the callback only proceeds when the value Google hands back
 * matches the one kept in a short-lived cookie), and it says which of the two
 * asks, signing in or connecting Drive, the round trip was for, so both can
 * share a single registered callback address.
 */

import type { AuthPurpose } from './google-oauth';

/** Name of the short-lived cookie holding the OAuth `state` value. */
export const STATE_COOKIE = 'chowdown_oauth_state';

/** How long a round trip to Google may take before it is abandoned, in seconds. */
export const STATE_TTL_SECONDS = 600;

/** A fresh `state` for the given purpose: `<purpose>.<random>`. */
export function newState(purpose: AuthPurpose): string {
  return `${purpose}.${crypto.randomUUID()}`;
}

/**
 * What a `state` value was made for, or undefined when it is not one of ours.
 * This only reads the label; trusting it still requires the value to match the
 * cookie.
 */
export function purposeOf(state: string): AuthPurpose | undefined {
  const [purpose, nonce] = state.split('.');
  return (purpose === 'signin' || purpose === 'drive') && nonce
    ? purpose
    : undefined;
}
