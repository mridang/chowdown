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
import { setFavourite } from '@/lib/db/favourites';
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

/** Whether `id` is a well-formed Drive file id of one of this user's recipes. */
async function ownsRecipe(userId: number, id: string): Promise<boolean> {
  if (!/^[\w-]+$/.test(id)) {
    return false;
  }
  const rows = await getRecipePageRows(getDatabase(), userId, id);
  return Boolean(rows.recipe);
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
  if (!(await ownsRecipe(auth.value, id))) {
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
  const id = (await params)['recipe-id'];
  if (await ownsRecipe(auth.value, id)) {
    await setFavouriteAndTag(auth.value, id, false);
  } else {
    // A heart can outlive its recipe (deleted in Drive). Removing it is always
    // fine and touches no file, so it still succeeds.
    await setFavourite(getDatabase(), auth.value, id, false);
  }
  return new NextResponse(null, { status: 204 });
}
