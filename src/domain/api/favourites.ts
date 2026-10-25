/**
 * @packageDocumentation
 *
 * The favourites API as a controller over the `core/api` framework: one page of
 * the recipes the signed-in person has hearted. The route file only mounts it.
 */

import { ApiController } from '@/lib/core/api';
import { liveUid } from '@/domain/api/auth';
import { listRecipes } from '@/domain/api/recipe-list';

/**
 * `GET /api/users/self/favourites`: one page of the recipes the user has
 * hearted, filtered and sorted by the query string (`favourite=true` is
 * implied). 200 with the page, 401 when nobody is signed in.
 */
export const favouritesCollection = new ApiController<{
  readonly request: Request;
  readonly uid: number;
}>({
  context: async (request) => ({ request, uid: await liveUid(request) }),
}).on({
  method: 'GET',
  // listRecipes already builds the page Response; send it as-is.
  handle: (_input, { request, uid }) =>
    listRecipes(request, uid, { favourite: 'true' }),
  encode: (response) => response,
});
