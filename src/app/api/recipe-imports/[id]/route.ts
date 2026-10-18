/**
 * One recipe import.
 *
 *   GET    /api/recipe-imports/:id   the import and its drafts
 *   DELETE /api/recipe-imports/:id   discard it
 */

import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/api/auth';
import { problems } from '@/lib/api/problem';
import { deleteRecipeImport, getRecipeImport } from '@/lib/db/recipe-imports';
import { getDatabase } from '@/lib/util';

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const found = await getRecipeImport(
    getDatabase(),
    auth.value,
    (await params).id,
  );
  return found
    ? NextResponse.json(found, {
        headers: { 'Cache-Control': 'private, no-cache' },
      })
    : problems.notFound('recipe import');
}

export async function DELETE(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const removed = await deleteRecipeImport(
    getDatabase(),
    auth.value,
    (await params).id,
  );
  return removed
    ? new NextResponse(null, { status: 204 })
    : problems.notFound('recipe import');
}
