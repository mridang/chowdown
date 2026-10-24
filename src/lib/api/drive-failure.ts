/**
 * @packageDocumentation
 *
 * The answer for a request that needed Google Drive and couldn't have it. If
 * the cause is that the person hasn't connected Drive (or Google has stopped
 * accepting the connection), say that, in a way a client can act on; anything
 * else is a Drive hiccup, and nothing was changed.
 */

import { DriveNotConnectedError } from '@/lib/auth/drive-access';
import { problems } from '@/lib/api/problem';

/** The problem response for `error`, with `detail` for the Drive-hiccup case. */
export function driveFailure(error: unknown, detail: string): Response {
  return error instanceof DriveNotConnectedError
    ? problems.driveNotConnected()
    : problems.upstream(detail);
}
