/**
 * @packageDocumentation
 *
 * Turning a person's stored Drive login (a sealed refresh token) into a fresh
 * access token, and deciding what each way that can fail means. The real
 * secrets and database are passed in, so the decisions can be tested on their
 * own; `getUserAccessToken` in `current-user.ts` supplies the real ones.
 */

import type { MintedToken } from '@/lib/auth/access-token-cache';
import { DriveNotConnectedError, isAuthFailure } from '@/lib/auth/drive-access';

/** What the exchange needs from the outside world. */
export interface AccessTokenDeps {
  /** Unseal the stored refresh token. Throws if it can't be unsealed. */
  readonly decrypt: (sealed: string) => Promise<string>;
  /** Trade a refresh token for an access token. Throws Google's refusal. */
  readonly refresh: (refreshToken: string) => Promise<MintedToken>;
  /** Forget the stored token, but only if it is still `sealed`. */
  readonly forget: (sealed: string) => Promise<void>;
}

/**
 * A fresh Drive access token (and its lifetime) for the stored login `sealed`.
 *
 * Throws {@link DriveNotConnectedError} when there is no login, when Google no
 * longer accepts it (it is forgotten first, so the person is offered
 * "reconnect" everywhere instead of being stuck as "connected" with nothing
 * working), or when it can't be unsealed. That last case is NOT forgotten: it
 * means the key here is not the one the token was sealed with (a bad deploy, a
 * rotation), and wiping every stored login over a configuration slip could not
 * be undone by putting the key back. Anything else, like a network failure, is
 * rethrown untouched.
 */
export async function accessTokenFor(
  sealed: string | null,
  deps: AccessTokenDeps,
): Promise<MintedToken> {
  if (!sealed) {
    throw new DriveNotConnectedError();
  }
  const refreshToken = await deps.decrypt(sealed).catch(() => {
    throw new DriveNotConnectedError();
  });
  try {
    return await deps.refresh(refreshToken);
  } catch (error) {
    if (isAuthFailure(error)) {
      await deps.forget(sealed);
      throw new DriveNotConnectedError();
    }
    throw error;
  }
}
