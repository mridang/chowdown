/**
 * @packageDocumentation
 *
 * The answer for a request that needed Google Drive and couldn't have it. If
 * the cause is that the person hasn't connected Drive (or Google has stopped
 * accepting the connection), say that, in a way a client can act on; anything
 * else is a Drive hiccup, and nothing was changed.
 */

import { driveNotConnected, upstream } from '@/domain/api/problems';
import { DriveNotConnectedError } from '@/domain/auth/drive-access';

/** The problem response for `error`, with `detail` for the Drive-hiccup case. */
export function driveFailure(error: unknown, detail: string): Response {
  return error instanceof DriveNotConnectedError
    ? driveNotConnected()
    : upstream(detail);
}
