/**
 * @packageDocumentation
 *
 * The app-specific problem responses, the ones the generic catalogue in
 * `@/lib/core/api` has no business knowing about: a request that needs Google
 * Drive before it can proceed, and an upstream (Drive, or another service we
 * depend on) that failed with nothing changed. Each is built on the generic
 * `problem()` helper so the wire shape stays identical to the standard ones.
 */

import { problem } from '@/lib/core/api';

/** The request needs Google Drive and the person hasn't connected it. */
export function driveNotConnected(): Response {
  return problem(
    409,
    '/problems/drive-not-connected',
    'Google Drive is not connected',
    'Connect your Google Drive in chowdown first, then try again.',
  );
}

/** Drive (or another upstream) failed; nothing was changed. */
export function upstream(detail: string): Response {
  return problem(502, '/problems/upstream-failure', 'Upstream failure', detail);
}
