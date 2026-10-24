/**
 * @packageDocumentation
 *
 * The recipe list response shared by `/api/recipes` and the user's favourites:
 * parse the query (`limit`, `sort`, `cursor` and the filters), filter and sort
 * the cached recipes, and return one page.
 */

import { getAppPageRows } from '@/lib/db/recipe-page';
import { sourceDomainOf } from '@/lib/cooklang/cook-text';
import { getDatabase } from '@/core/runtime';
import {
  decodeCursor,
  pageBody,
  parseLimit,
  sliceAfter,
} from '@/core/api/pagination';
import { problems } from '@/lib/rest-json/problem';
import {
  comparePositions,
  filterRecipes,
  parseSort,
  positionOf,
  sortRecipes,
  type QueryableRecipe,
} from '@/lib/api/recipe-query';
import { recipeSummary, type RecipeSummary } from '@/lib/api/recipe-resource';

/**
 * The query with each forced parameter set to its forced value, replacing
 * whatever the client sent for it.
 */
function withForced(
  query: URLSearchParams,
  forced: Readonly<Record<string, string>>,
): URLSearchParams {
  return new URLSearchParams([
    ...[...query].filter(([key]) => !Object.hasOwn(forced, key)),
    ...Object.entries(forced),
  ]);
}

/**
 * One page of the user's recipes. `forced` adds filters the caller always wants
 * (the favourites collection forces `favourite=true`).
 */
export async function listRecipes(
  request: Request,
  userId: number,
  forced: Readonly<Record<string, string>> = {},
): Promise<Response> {
  const query = withForced(new URL(request.url).searchParams, forced);
  if (query.has('favourite') && !('favourite' in forced)) {
    return problems.badRequest(
      'favourite is not a filter of this list. Favourites are listed at /api/users/self/favourites.',
    );
  }
  const limit = parseLimit(query.get('limit'));
  if (typeof limit !== 'number') {
    return limit;
  }
  const order = parseSort(query.get('sort'));
  if (!order) {
    return problems.badRequest(
      'sort must be title or modified_at, optionally prefixed with + or -.',
    );
  }
  const cursorParam = query.get('cursor');
  const after = cursorParam ? decodeCursor(cursorParam) : undefined;
  if (cursorParam && !after) {
    return problems.badRequest('The cursor is not valid.');
  }

  const { recipes, favouriteIds } = await getAppPageRows(getDatabase(), userId);
  const hearted = new Set(favouriteIds);
  const rows: readonly (QueryableRecipe & {
    readonly summary: RecipeSummary;
  })[] = recipes.map((row) => {
    const summary = recipeSummary(row, hearted.has(row.drive_file_id));
    return {
      id: summary.id,
      title: summary.title,
      modified_at: summary.modified_at,
      display: summary.title,
      favourite: summary.favourite,
      domain: sourceDomainOf(row.source),
      tags: summary.tags,
      summary,
    };
  });

  const sorted = sortRecipes(filterRecipes(rows, query), order);
  const page = sliceAfter(
    sorted,
    (r) => positionOf(r, order),
    comparePositions(order),
    after,
    limit,
  );
  return Response.json(
    pageBody(
      request,
      page.items.map((r) => r.summary),
      page.next,
    ),
    { headers: { 'Cache-Control': 'private, no-cache' } },
  );
}
