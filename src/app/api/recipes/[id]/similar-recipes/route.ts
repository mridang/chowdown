/**
 * Recipes similar to this one, most similar first. Precomputed from the
 * recipes' embeddings and read straight from the D1 cache.
 *
 *   GET /api/recipes/:id/similar-recipes
 */

import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/api/auth';
import { pageBody } from '@/lib/api/pagination';
import { problems } from '@/lib/api/problem';
import { getRecipePageRows } from '@/lib/db/recipe-page';
import { parseSimilar } from '@/lib/recipe/similar';
import { getDatabase } from '@/lib/util';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireUid(request);
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
