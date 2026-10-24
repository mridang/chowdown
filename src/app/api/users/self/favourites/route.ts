/**
 * The signed-in user's favourite recipes, as a list of recipe summaries. It
 * takes the same query parameters as `/api/recipes` (search, facets, sort,
 * pagination); `favourite=true` is implied.
 *
 *   GET /api/users/self/favourites
 */

import { ApiController } from '@/core/api/controller';
import { liveUid } from '@/domain/api/auth';
import { listRecipes } from '@/domain/api/recipe-list';

/**
 * `GET /api/users/self/favourites`: one page of the recipes the user has
 * hearted, filtered and sorted by the query string. Answers 200 with the page,
 * or 401 when nobody is signed in.
 */
export const GET = new ApiController<{
  readonly request: Request;
  readonly uid: number;
}>({
  context: async (request) => ({ request, uid: await liveUid(request) }),
})
  .on({
    method: 'GET',
    handle: (_input, { request, uid }) =>
      listRecipes(request, uid, { favourite: 'true' }),
  })
  .handler('GET');
