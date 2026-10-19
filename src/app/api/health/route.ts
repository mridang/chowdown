/**
 * Minimal health endpoint for uptime monitors.
 *
 *   GET /api/health → 200 { ok, db, ts }
 */

import { isDatabaseBound } from '@/lib/util';

/** Never prerender or cache this route: the answer must reflect right now. */
export const dynamic = 'force-dynamic';

/**
 * `GET /api/health`: reports whether the D1 binding is reachable from the
 * current request context. Always 200 (no sign-in needed): the monitor wants
 * to know the Worker is up, and a missing database binding is reported in the
 * body (`db: false`) rather than failing the check.
 */
export function GET(): Response {
  return Response.json(
    { ok: true, db: isDatabaseBound(), ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
