/**
 * The apps (ChatGPT, Claude…) the user has connected with sign-in.
 *
 *   GET /api/users/self/connected-apps
 */

import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/api/auth';
import { pageBody } from '@/lib/api/pagination';
import { listConnectedApps } from '@/lib/db/oauth';
import { getDatabase } from '@/lib/util';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const apps = await listConnectedApps(getDatabase(), auth.value);
  return NextResponse.json(
    pageBody(
      request,
      apps.map((a) => {
        const app: {
          id: string;
          name: string;
          scopes: string[];
          connected_at: string;
          last_used_at?: string;
        } = {
          id: a.grantId,
          name: a.name,
          scopes: a.scope,
          connected_at: a.connectedAt,
        };
        if (a.lastUsedAt) {
          app.last_used_at = a.lastUsedAt;
        }
        return app;
      }),
    ),
    { headers: { 'Cache-Control': 'private, no-cache' } },
  );
}
