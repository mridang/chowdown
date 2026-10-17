/**
 * Disconnect an app: revokes the grant, so its access and refresh tokens stop
 * working immediately.
 *
 *   DELETE /api/oauth/grants/:id → { revoked: true }
 */

import { NextResponse } from 'next/server';

import { getSessionUid } from '@/lib/auth/current-user';
import { revokeConnectedApp } from '@/lib/db/oauth';
import { getDatabase } from '@/lib/util';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const uid = await getSessionUid();
  if (uid === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const revoked = await revokeConnectedApp(getDatabase(), uid, id);
  return revoked
    ? NextResponse.json({ revoked: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
