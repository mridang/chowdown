/**
 * @packageDocumentation
 *
 * Deciding whether a Google round trip made to connect Drive actually gave us
 * Drive: the right Google account approved it, the person did not untick the
 * Drive permission, and Google sent a refresh token. Each failure has its own
 * fixed outcome for the person and a line for our logs; nothing Google sent
 * back is ever shown.
 */

import type { DriveAttempt } from '@/domain/auth/drive-access';
import { grantedDrive } from '@/domain/auth/drive-oauth';
import type { TokenResponse } from '@/lib/google';

/** What the check needs to know. */
export interface DriveGrant {
  /** The Google account that just approved (`sub` from userinfo). */
  readonly approvedBy: string;
  /** The Google account the signed-in person signed in with. */
  readonly signedInAs: string;
  /** Google's answer to the code exchange. */
  readonly tokens: Pick<TokenResponse, 'scope' | 'refresh_token'>;
}

/** Whether to go ahead and store the refresh token, or how to turn the person back. */
export type DriveGrantCheck =
  | { readonly ok: true; readonly refreshToken: string }
  | {
      readonly ok: false;
      /** What to tell the person (as `?drive=`). */
      readonly result: DriveAttempt;
      /** What to log, if anything is worth logging. */
      readonly log?: string;
    };

/** Check a Drive grant, in the order that matters: account first, then the permission, then the token. */
export function checkDriveGrant(grant: DriveGrant): DriveGrantCheck {
  if (grant.approvedBy !== grant.signedInAs) {
    return {
      ok: false,
      result: 'error',
      log: '[auth callback] drive grant from a different account',
    };
  }
  if (!grantedDrive(grant.tokens.scope)) {
    // They unticked the Drive permission.
    return { ok: false, result: 'denied' };
  }
  return grant.tokens.refresh_token
    ? { ok: true, refreshToken: grant.tokens.refresh_token }
    : {
        ok: false,
        result: 'error',
        log: '[auth callback] drive grant carried no refresh token',
      };
}
