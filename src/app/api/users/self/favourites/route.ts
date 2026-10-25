/**
 * The signed-in user's favourite recipes, as a list of recipe summaries. Takes
 * the same query parameters as `/api/recipes` (search, facets, sort,
 * pagination); `favourite=true` is implied.
 *
 *   GET /api/users/self/favourites
 *
 * The behaviour lives in the `favouritesCollection` controller; this file only
 * mounts it.
 */

import { favouritesCollection } from '@/domain/api/favourites';

export const dynamic = 'force-dynamic';

export const { GET } = favouritesCollection.handlers();
