/**
 * Recipes similar to this one, most similar first. Precomputed from the
 * recipes' embeddings and read straight from the D1 cache.
 *
 *   GET /api/recipes/:id/similar
 */

import { NextResponse } from 'next/server';

import { requireLiveUid } from '@/domain/api/auth';
import { pageBody } from '@/core/api/pagination';
import { problems } from '@/lib/rest-json/problem';
import type { IdContext } from '@/core/api/route-context';
import { getRecipePageRows } from '@/domain/db/recipe-page';
import { parseSimilar } from '@/domain/recipe/similar';
import { getDatabase } from '@/core/runtime';

/**
 * `GET /api/recipes/:id/similar`: the recipes closest in meaning to
 * this one, as `{ id, title }` entries. Answers 200 with a page (empty if the
 * list has not been computed yet), 404 for a recipe the user does not have,
 * 401 when nobody is signed in.
 */
export async function GET(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const rows = await getRecipePageRows(
    getDatabase(),
    auth.value,
    (await params).id,
  );
  if (!rows.recipe) {
    return problems.notFound('recipe');
  }
  const items = parseSimilar(rows.similarJson).map((s) => ({
    id: s.id,
    title: s.title,
  }));
  return NextResponse.json(pageBody(request, items), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}
