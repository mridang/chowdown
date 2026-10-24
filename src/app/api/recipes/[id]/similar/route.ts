/**
 * Recipes similar to this one, most similar first. Precomputed from the
 * recipes' embeddings and read straight from the D1 cache.
 *
 *   GET /api/recipes/:id/similar
 */

import { ApiController } from '@/core/api/controller';
import { liveUid } from '@/domain/api/auth';
import { pageBody } from '@/core/api/pagination';
import { ProblemError, problems } from '@/lib/rest-json/problem';
import type { IdContext } from '@/core/api/route-context';
import { getRecipePageRows } from '@/domain/db/recipe-page';
import { parseSimilar } from '@/domain/recipe/similar';
import { getDatabase } from '@/core/runtime';

/**
 * `GET /api/recipes/:id/similar`: the recipes closest in meaning to this one,
 * as `{ id, title }` entries. Answers 200 with a page (empty if the list has
 * not been computed yet), 404 for a recipe the user does not have, 401 when
 * nobody is signed in.
 */
export const GET = new ApiController<
  { readonly request: Request; readonly uid: number; readonly id: string },
  IdContext
>({
  context: async (request, route) => ({
    request,
    uid: await liveUid(request),
    id: (await route.params).id,
  }),
})
  .on({
    method: 'GET',
    handle: async (_input, { uid, id }) => {
      const rows = await getRecipePageRows(getDatabase(), uid, id);
      if (!rows.recipe) {
        throw new ProblemError(problems.notFound('recipe'));
      }
      return parseSimilar(rows.similarJson).map((s) => ({
        id: s.id,
        title: s.title,
      }));
    },
    encode: (items, { request }) => ({
      body: pageBody(request, items),
      headers: { 'Cache-Control': 'private, no-cache' },
    }),
  })
  .handler('GET');
