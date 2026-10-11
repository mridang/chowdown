/**
 * Favourite ("heart") toggle for a single recipe.
 *
 *   POST /api/recipes/:id/favourite  { on: boolean } → { favourite }
 *
 * Hearts are per-user and stored in D1 keyed by the Drive file id. We don't
 * verify the id against Drive here — a heart is cheap, user-scoped metadata,
 * and a stale id simply gets pruned when its recipe stops appearing.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { setFavourite } from '@/lib/db/favourites';
import { getDatabase } from '@/lib/util';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    on?: boolean;
  } | null;
  const on = body?.on !== false; // default to hearting when unspecified
  const favourite = await setFavourite(getDatabase(), user.id, id, on);
  return NextResponse.json({ favourite });
}
