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
import { setFavourite } from '@/lib/db/favourites';
import { getRecipePageRows } from '@/lib/db/recipe-page';
import { isDriveFileId } from '@/lib/drive/drive-client';
import { setFavouriteAndTag } from '@/lib/recipe/favourite';
import { getDatabase } from '@/lib/util';

/** The context Next.js hands these handlers: the recipe's id. */
interface RecipeContext {
  readonly params: Promise<{ readonly 'recipe-id': string }>;
}

/** Whether `id` is a well-formed Drive file id of one of this user's recipes. */
async function ownsRecipe(userId: number, id: string): Promise<boolean> {
  if (!isDriveFileId(id)) {
    return false;
  }
  const rows = await getRecipePageRows(getDatabase(), userId, id);
  return Boolean(rows.recipe);
}

/**
 * `GET /api/users/self/favourite-recipes/:recipe-id`: the recipe's summary, if
 * the user has hearted it. Answers 200, 404 when it is not one of their
 * favourites, 401 when nobody is signed in.
 */
export async function GET(
  request: Request,
  { params }: RecipeContext,
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

/**
 * `PUT /api/users/self/favourite-recipes/:recipe-id`: heart a recipe. Hearting
 * twice is fine. Answers 204, 404 for a recipe the user does not have, 401
 * when nobody is signed in.
 */
export async function PUT(
  request: Request,
  { params }: RecipeContext,
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

/**
 * `DELETE /api/users/self/favourite-recipes/:recipe-id`: remove the heart.
 * Removing one that is not there is fine, even for a recipe that no longer
 * exists. Answers 204, or 401 when nobody is signed in.
 */
export async function DELETE(
  request: Request,
  { params }: RecipeContext,
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
