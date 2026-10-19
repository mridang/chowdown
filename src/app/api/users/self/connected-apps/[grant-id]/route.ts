/**
 * Disconnect an app: its access and refresh tokens stop working immediately.
 *
 *   DELETE /api/users/self/connected-apps/:grant-id → 204
 */

import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/api/auth';
import { problems } from '@/lib/api/problem';
import { revokeConnectedApp } from '@/lib/db/oauth';
import { getDatabase } from '@/lib/util';

/**
 * `DELETE /api/users/self/connected-apps/:grant-id`: revoke the app's access
 * right away. Answers 204, 404 when the grant is not the user's (or is already
 * revoked), 401 when nobody is signed in.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ 'grant-id': string }> },
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const revoked = await revokeConnectedApp(
    getDatabase(),
    auth.value,
    (await params)['grant-id'],
  );
  return revoked
    ? new NextResponse(null, { status: 204 })
    : problems.notFound('connected app');
}
