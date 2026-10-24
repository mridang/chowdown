/**
 * @packageDocumentation
 *
 * The "recipes similar to this one" API as a controller over the `core/api`
 * framework. Read straight from the D1 cache (precomputed from embeddings). The
 * route file only mounts it.
 */

import { ApiController } from '@/core/api/controller';
import { liveUid } from '@/domain/api/auth';
import { pageBody } from '@/core/api/pagination';
import { problems } from '@/lib/rest-json/problem';
import { getRecipePageRows } from '@/domain/db/recipe-page';
import { parseSimilar } from '@/domain/recipe/similar';
import { getDatabase } from '@/core/runtime';

/**
 * `GET /api/recipes/:id/similar`: the recipes closest in meaning to this one,
 * as `{ id, title }` entries. 200 with a page (empty if not computed yet), 404
 * for a recipe the user does not have, 401 when nobody is signed in.
 */
export const recipeSimilar = new ApiController<{
  readonly request: Request;
  readonly uid: number;
  readonly id: string;
}>({
  context: async (request, route) => ({
    request,
    uid: await liveUid(request),
    id: (await route.params)?.['id'] ?? '',
  }),
}).on({
  method: 'GET',
  handle: async (_input, { uid, id }) => {
    const rows = await getRecipePageRows(getDatabase(), uid, id);
    if (!rows.recipe) {
      throw problems.notFound('recipe');
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
});
