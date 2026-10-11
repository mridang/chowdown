/**
 * Single-recipe API: read a `.cook` file's raw source by its Drive id. The
 * browser parses the source for display; keeping the fetch server-side means
 * the Drive token stays on the Worker.
 *
 *   GET /api/recipes/:id → { source }
 */

import { NextResponse } from 'next/server';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { getFileContent } from '@/lib/drive/drive-client';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const accessToken = await getUserAccessToken(user);
  try {
    const source = await getFileContent(id, accessToken);
    return NextResponse.json({ source });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
