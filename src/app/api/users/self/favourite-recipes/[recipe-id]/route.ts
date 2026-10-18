/**
 * One of the user's favourite recipes. Favouriting is creating this resource,
 * un-favouriting is deleting it; both are idempotent.
 *
 *   GET    /api/users/self/favourite-recipes/:recipe-id   the recipe, if favourited
 *   PUT    /api/users/self/favourite-recipes/:recipe-id   favourite it → 204
 *   DELETE /api/users/self/favourite-recipes/:recipe-id   un-favourite it → 204
 */

import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/api/auth';
import { problems } from '@/lib/api/problem';
import { recipeSummary } from '@/lib/api/recipe-resource';
import { getRecipePageRows } from '@/lib/db/recipe-page';
import { setFavouriteAndTag } from '@/lib/recipe/favourite';
import { getDatabase } from '@/lib/util';

type Context = { params: Promise<{ 'recipe-id': string }> };

export async function GET(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const rows = await getRecipePageRows(
    getDatabase(),
    auth.value,
    (await params)['recipe-id'],
  );
  if (!rows.recipe || !rows.favourite) {
    return problems.notFound('favourite recipe');
  }
  return NextResponse.json(recipeSummary(rows.recipe, true), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}

export async function PUT(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const id = (await params)['recipe-id'];
  // Only the user's own recipes can be favourited.
  const rows = await getRecipePageRows(getDatabase(), auth.value, id);
  if (!rows.recipe) {
    return problems.notFound('recipe');
  }
  await setFavouriteAndTag(auth.value, id, true);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  await setFavouriteAndTag(auth.value, (await params)['recipe-id'], false);
  return new NextResponse(null, { status: 204 });
}
