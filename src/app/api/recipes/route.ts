/**
 * The recipe collection.
 *
 *   GET  /api/recipes   list recipes (filter, sort, paginate)
 *   POST /api/recipes   create a recipe from Cooklang text
 *
 * Listing is served from the D1 cache, so it never waits on Drive. Creating
 * writes the file to the user's Drive and indexes it. The recipe's source URL
 * (`>> source:`) is a secondary key: posting a recipe whose source is already
 * saved returns that recipe with 200 instead of making a duplicate.
 */

import { NextResponse } from 'next/server';

import { getUserAccessToken } from '@/lib/auth/current-user';
import { requireUid, requireUser } from '@/lib/api/auth';
import { isObject, readJson } from '@/lib/api/json';
import { absoluteUrl } from '@/lib/api/pagination';
import { driveFailure } from '@/lib/api/drive-failure';
import { problems } from '@/lib/api/problem';
import { sendRecipe } from '@/lib/api/recipe-response';
import { listRecipes } from '@/lib/api/recipe-list';
import { findRecipeBySourceUrl } from '@/lib/db/recipes';
import { createRecipeFile } from '@/lib/drive/drive-client';
import { recipesFolderFor } from '@/lib/drive/recipes-folder';
import { sourceUrlOf } from '@/lib/recipe/cook-text';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';
import { getDatabase } from '@/lib/util';

/** Largest Cooklang body accepted. */
const MAX_COOKLANG_BYTES = 200_000;

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  return listRecipes(request, auth.value);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;
  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  if (!isObject(body.value)) {
    return problems.badRequest('The request body must be a JSON object.');
  }
  const { name, cooklang } = body.value;
  const errors: string[] = [];
  if (typeof name !== 'string' || !name.trim() || name.length > 200) {
    errors.push('name: required, up to 200 characters.');
  }
  if (typeof cooklang !== 'string' || !cooklang.trim()) {
    errors.push('cooklang: required.');
  } else if (cooklang.length > MAX_COOKLANG_BYTES) {
    errors.push('cooklang: too large.');
  }
  if (
    errors.length > 0 ||
    typeof name !== 'string' ||
    typeof cooklang !== 'string'
  ) {
    return problems.badRequest('The recipe is not valid.', errors);
  }

  const db = getDatabase();
  const sourceUrl = sourceUrlOf(cooklang);
  if (sourceUrl) {
    const existing = await findRecipeBySourceUrl(db, user.id, sourceUrl);
    if (existing) {
      const response = await sendRecipe(
        request,
        user.id,
        existing.drive_file_id,
        200,
      );
      response.headers.set(
        'Content-Location',
        absoluteUrl(request, `/api/recipes/${existing.drive_file_id}`),
      );
      return response;
    }
  }

  let created;
  try {
    const token = await getUserAccessToken(user);
    const folderId = await recipesFolderFor(user, token);
    created = await createRecipeFile(folderId, name.trim(), cooklang, token);
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the recipe. Nothing was changed.',
    );
  }
  await indexRecipeWrite(db, user.id, created.id, created.name, cooklang);
  const response = await sendRecipe(request, user.id, created.id, 201);
  response.headers.set(
    'Location',
    absoluteUrl(request, `/api/recipes/${created.id}`),
  );
  return response;
}
