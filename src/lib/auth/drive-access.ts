/**
 * @packageDocumentation
 *
 * Whether a person has connected their Google Drive. Signing in and connecting
 * Drive are separate steps, so someone can be signed in with no Drive access:
 * they can look around, but anything that reads or writes their recipe files
 * needs the connection first. Connecting stores a sealed refresh token; Google
 * rejecting it later clears that token, so "has a token" is the whole test.
 */

/** Thrown when something needs Drive and the person hasn't connected it. */
export class DriveNotConnectedError extends Error {
  override readonly name = 'DriveNotConnectedError';

  constructor() {
    super('Google Drive is not connected');
  }
}

/** Whether the person has a Drive connection (a stored refresh token). */
export function isDriveConnected(
  user: Readonly<{ refresh_token_enc: string | null }>,
): boolean {
  return Boolean(user.refresh_token_enc);
}

/**
 * Whether a person who is not connected used to be: they have a Recipes folder
 * on record, so Google must have stopped accepting the stored login (or they
 * removed chowdown). The wording then says "reconnect" rather than "connect".
 */
export function wasDriveConnected(
  user: Readonly<{ recipes_folder_id: string | null }>,
): boolean {
  return Boolean(user.recipes_folder_id);
}

/**
 * The address that starts connecting Drive, coming back to `returnTo` after.
 * `force` is for a page that already knows Drive is not usable: it makes the
 * route go to Google even if a stored login is on record (one that can no
 * longer be unsealed would otherwise be taken for a working connection).
 */
export function driveConnectHref(
  returnTo?: string,
  options: Readonly<{ force?: boolean }> = {},
): string {
  const text = new URLSearchParams([
    ...(returnTo ? [['returnTo', returnTo]] : []),
    ...(options.force ? [['force', '1']] : []),
  ]).toString();
  return text ? `/api/auth/drive?${text}` : '/api/auth/drive';
}

/** Why the last attempt to connect didn't take, from the address it came back to. */
export type DriveAttempt = 'denied' | 'error';

/** Reads `?drive=` off a page's query string, ignoring anything unexpected. */
export function driveAttemptOf(
  value: string | readonly string[] | undefined,
): DriveAttempt | undefined {
  const one = typeof value === 'string' ? value : value?.[0];
  return one === 'denied' || one === 'error' ? one : undefined;
}

/**
 * Whether an error means Google rejected the stored login (an expired or
 * revoked refresh token), as opposed to a passing network or Drive hiccup or a
 * problem on our side (a rotated client secret answers `invalid_client`, which
 * must not wipe every person's connection). Only the former should send the
 * person back to connect Drive again.
 */
export function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant/i.test(message);
}

/**
 * Whether the session cookie's Drive hint disagrees with the database, so the
 * cookie should be reissued. A cookie from before the hint existed (undefined)
 * counts as out of date: reissuing it once saves a database read on every page.
 */
export function sessionHintStale(
  hint: boolean | undefined,
  connected: boolean,
): boolean {
  return hint !== connected;
}
