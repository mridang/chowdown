/**
 * Auto-tag a recipe. This is deliberately *not* part of the REST API: it isn't a
 * resource, it's a call to a model. It classifies the recipe against the curated
 * taxonomy with Workers AI, writes the validated tags into the `.cook` file, and
 * fills in a missing cover from the recipe's source page. Nothing is written
 * when the model can't confidently tag it, so it can never corrupt a recipe.
 *
 *   POST /rpc/tag-recipe  { recipe_id } → { tagged, tags }
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { isObject, readJson } from '@/lib/api/json';
import { driveFailure } from '@/lib/api/drive-failure';
import { budgetRefusal } from '@/lib/api/daily-budget';
import { problems } from '@/lib/api/problem';
import { getUserAccessToken } from '@/lib/auth/current-user';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { getFileContent, updateRecipeFile } from '@/lib/drive/drive-client';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';
import { tagCookSource } from '@/lib/recipe/tagging';
import { addMissingCover } from '@/lib/recipe/to-cooklang';
import { getDatabase, getEnv } from '@/lib/util';
import { DAILY_BUDGETS } from '@/lib/util/daily-budget';

/**
 * `POST /rpc/tag-recipe`: classify one of the user's recipes and write the tags
 * (and a missing cover) onto its file. Answers 200 with `{ tagged, tags }`
 * (`tagged: false` when nothing could be confidently tagged, in which case
 * nothing is written), 400 for a missing `recipe_id`, 404 for a recipe the user
 * does not have. Needs a signed-in user: 401, and 409 or 502 when Drive is not
 * connected or fails.
 */
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
  const id = isObject(body.value) ? body.value['recipe_id'] : undefined;
  if (typeof id !== 'string' || !id) {
    return problems.badRequest('recipe_id is required.');
  }
  const db = getDatabase();
  const row = await getRecipeByFileId(db, user.id, id);
  if (!row) {
    return problems.notFound('recipe');
  }
  const spent = await budgetRefusal(DAILY_BUDGETS.tag, user.id, 'tagging');
  if (spent) {
    return spent;
  }
  try {
    const token = await getUserAccessToken(user);
    const original = await getFileContent(id, token);
    const { source: tagged, tags } = await tagCookSource(
      original,
      'recipe.cook',
      getEnv(),
    );
    const source = await addMissingCover(tagged);
    if (tags.length === 0 && source === original) {
      return NextResponse.json({ tagged: false, tags: [] });
    }
    await updateRecipeFile(id, source, token);
    await indexRecipeWrite(db, user.id, id, row.name, source);
    return NextResponse.json({ tagged: true, tags });
  } catch (error) {
    return driveFailure(
      error,
      'The recipe could not be tagged. Nothing was changed.',
    );
  }
}
