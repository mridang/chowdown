/**
 * The apps (ChatGPT, Claude…) the user has connected with sign-in.
 *
 *   GET /api/users/self/connections
 */

import { NextResponse } from 'next/server';

import { requireLiveUid } from '@/lib/api/auth';
import { pageBody } from '@/lib/api/pagination';
import { connectedAppResource } from '@/lib/connected-apps';
import { listConnectedApps } from '@/lib/db/oauth';
import { getDatabase } from '@/lib/util/runtime';

/**
 * `GET /api/users/self/connections`: the apps the user has approved and not
 * disconnected, newest first. Answers 200 with a page of apps, or 401 when
 * nobody is signed in.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const apps = await listConnectedApps(getDatabase(), auth.value);
  return NextResponse.json(pageBody(request, apps.map(connectedAppResource)), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}
