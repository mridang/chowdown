/**
 * The apps the signed-in user has connected over OAuth.
 *
 *   GET /api/oauth/grants → { apps: ConnectedApp[] }
 */

import { NextResponse } from 'next/server';

import { getSessionUid } from '@/lib/auth/current-user';
import { listConnectedApps } from '@/lib/db/oauth';
import { getDatabase } from '@/lib/util';

export async function GET(): Promise<NextResponse> {
  const uid = await getSessionUid();
  if (uid === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const apps = await listConnectedApps(getDatabase(), uid);
  return NextResponse.json(
    { apps },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
