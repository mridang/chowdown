/**
 * The signed-in user's favourite recipes, as a list of recipe summaries. It
 * takes the same query parameters as `/api/recipes` (search, facets, sort,
 * pagination); `favourite=true` is implied.
 *
 *   GET /api/users/self/favourites
 */

import { requireLiveUid } from '@/domain/api/auth';
import { listRecipes } from '@/domain/api/recipe-list';

/**
 * `GET /api/users/self/favourites`: one page of the recipes the user has
 * hearted, filtered and sorted by the query string. Answers 200 with the page,
 * or 401 when nobody is signed in.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  return listRecipes(request, auth.value, { favourite: 'true' });
}
