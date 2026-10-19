/**
 * Find who wrote a recipe. Like auto-tagging this is not a resource but a call
 * to a model (and a fetch of the recipe's source page), so it lives outside the
 * REST API. The author is read from the page the recipe came from (what the
 * page declares, else what a model reads out of it; see `recipe/author.ts`),
 * and written onto the recipe's file as a `>> author:` line. Nothing is written
 * when no credible name is found.
 *
 *   POST /rpc/find-author  { recipe_id } → { author, saved }
 *   GET  /rpc/find-author?after=&limit=  → { processed, found, remaining, next }
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { budgetRefusal } from '@/lib/api/daily-budget';
import { driveFailure } from '@/lib/api/drive-failure';
import { isObject, readJson } from '@/lib/api/json';
import { problems } from '@/lib/api/problem';
import { getUserAccessToken } from '@/lib/auth/current-user';
import type { User } from '@/lib/db/users';
import { getRecipeByFileId, listAuthorlessRecipes } from '@/lib/db/recipes';
import { getFileContent, updateRecipeFile } from '@/lib/drive/drive-client';
import { authorFromSource, hasAuthor } from '@/lib/recipe/author';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';
import { addMissingAuthor } from '@/lib/recipe/to-cooklang';
import { getDatabase, getEnv } from '@/lib/util';
import { DAILY_BUDGETS } from '@/lib/util/daily-budget';

/** How many recipes one batch looks at by default, and at most. */
const DEFAULT_BATCH = 3;
const MAX_BATCH = 5;

/** What looking up one recipe's author came to. */
interface Lookup {
  readonly author: string | null;
  readonly saved: boolean;
}

/**
 * Look up the author of one recipe and, when one is found, write it onto the
 * file in Drive and into the cache. Drive failures are thrown for the caller to
 * answer.
 */
async function lookUp(
  user: Readonly<User>,
  fileId: string,
  name: string,
  token: string,
): Promise<Lookup> {
  const original = await getFileContent(fileId, token);
  if (hasAuthor(original)) {
    return { author: authorFromSource(original) ?? null, saved: false };
  }
  const source = await addMissingAuthor(original, getEnv());
  if (source === original) {
    return { author: null, saved: false };
  }
  await updateRecipeFile(fileId, source, token);
  await indexRecipeWrite(getDatabase(), user.id, fileId, name, source);
  return { author: authorFromSource(source) ?? null, saved: true };
}

/** What a failed lookup answers: the Drive problem, in this endpoint's words. */
const FAILURE = 'The author could not be looked up. Nothing was changed.';

/**
 * `POST /rpc/find-author`: look up the author of one of the user's recipes.
 * Answers 200 with `{ author, saved }` (`saved: false` when the recipe already
 * had an author, or none could be found; nothing is written then), 400 for a
 * missing `recipe_id`, 404 for a recipe the user does not have, 429 once the
 * day's lookups are used. Needs a signed-in user: 401, and 409 or 502 when Drive
 * is not connected or fails.
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
  const row = await getRecipeByFileId(getDatabase(), user.id, id);
  if (!row) {
    return problems.notFound('recipe');
  }
  const spent = await budgetRefusal(
    DAILY_BUDGETS.author,
    user.id,
    'author lookup',
  );
  if (spent) {
    return spent;
  }
  try {
    const token = await getUserAccessToken(user);
    return NextResponse.json(await lookUp(user, id, row.name, token));
  } catch (error) {
    return driveFailure(error, FAILURE);
  }
}

/** The batch size asked for, kept between one and the most allowed. */
function batchSize(value: string | null): number {
  const asked = Number.parseInt(value ?? '', 10);
  return Number.isNaN(asked)
    ? DEFAULT_BATCH
    : Math.min(Math.max(asked, 1), MAX_BATCH);
}

/**
 * `GET /rpc/find-author?after=<file id>&limit=<n>`: look up the authors of the
 * next few of the user's recipes that have a source page but no author, in a
 * stable order after `after`. Answers 200 with how many were looked at, how
 * many got an author, how many are left, and the id to pass as `after` for the
 * next batch (null when none are left). A caller loops until `next` is null.
 * Answers 429 once the day's lookups are used, before looking up more; needs a
 * signed-in user: 401, and 409 or 502 when Drive is not connected or fails.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;
  const params = new URL(request.url).searchParams;
  const { rows } = await listAuthorlessRecipes(
    getDatabase(),
    user.id,
    params.get('after') ?? '',
    batchSize(params.get('limit')),
  );
  try {
    const token = rows.length > 0 ? await getUserAccessToken(user) : '';
    const found = await rows.reduce<Promise<number>>(async (soFar, row) => {
      const count = await soFar;
      const spent = await budgetRefusal(
        DAILY_BUDGETS.author,
        user.id,
        'author lookup',
      );
      if (spent) {
        throw spent;
      }
      const result = await lookUp(user, row.drive_file_id, row.name, token);
      return count + (result.saved ? 1 : 0);
    }, Promise.resolve(0));
    const last = rows.at(-1)?.drive_file_id;
    // No rows asked for: only how many are left after the last one handled.
    const { remaining } = await listAuthorlessRecipes(
      getDatabase(),
      user.id,
      last ?? params.get('after') ?? '',
      0,
    );
    return NextResponse.json({
      processed: rows.length,
      found,
      remaining,
      next: last !== undefined && remaining > 0 ? last : null,
    });
  } catch (error) {
    return error instanceof NextResponse ? error : driveFailure(error, FAILURE);
  }
}
