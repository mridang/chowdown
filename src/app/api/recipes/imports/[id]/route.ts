/**
 * One recipe import.
 *
 *   GET    /api/recipes/imports/:id   the import and its drafts
 *   DELETE /api/recipes/imports/:id   discard it
 */

import { NextResponse } from 'next/server';

import { requireLiveUid } from '@/lib/api/auth';
import { problems } from '@/lib/api/problem';
import type { IdContext } from '@/lib/api/route-context';
import { deleteRecipeImport, getRecipeImport } from '@/lib/db/recipe-imports';
import { getDatabase } from '@/lib/util/runtime';

/**
 * `GET /api/recipes/imports/:id`: the import with all its drafts. Answers 200,
 * 404 for an import the user does not have, 401 when nobody is signed in.
 */
export async function GET(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireLiveUid(request);
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

/**
 * `DELETE /api/recipes/imports/:id`: discard the import. Answers 204, 404 for an
 * import the user does not have, 401 when nobody is signed in.
 */
export async function DELETE(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireLiveUid(request);
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
