import { getDB } from '../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * Minimal health endpoint for uptime monitors. Reports whether the D1
 * binding is reachable from the current request context. Always 200: the
 * monitor wants to know the Worker is up, and a missing database binding is
 * reported in the body rather than failing the check.
 */
export async function GET() {
  let db = false;
  try {
    db = Boolean(getDB());
  } catch {
    db = false;
  }
  return Response.json(
    { ok: true, db, ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
