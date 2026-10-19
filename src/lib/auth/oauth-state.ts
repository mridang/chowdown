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

/** Whether a returning `state` can be trusted, and for which ask. */
export type StateCheck =
  /** It matches the cookie and names its purpose: carry on. */
  | { readonly ok: true; readonly purpose: AuthPurpose }
  /**
   * It does not: stop. `claimed` is the purpose its label says (never trusted,
   * only used to pick the wording of the error), if it has one.
   */
  | { readonly ok: false; readonly claimed: AuthPurpose | undefined };

/**
 * Check the `state` Google handed back against the one kept in the cookie. They
 * must both be present and equal, and the value must carry one of our labels.
 */
export function checkState(
  state: string | null,
  expected: string | undefined,
): StateCheck {
  const purpose = state ? purposeOf(state) : undefined;
  return state && expected && state === expected && purpose
    ? { ok: true, purpose }
    : { ok: false, claimed: purpose };
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
