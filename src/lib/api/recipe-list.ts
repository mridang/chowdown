/**
 * @packageDocumentation
 *
 * The recipe list response shared by `/api/recipes` and the user's favourites:
 * parse the query (`limit`, `sort`, `cursor` and the filters), filter and sort
 * the cached recipes, and return one page.
 */

import { NextResponse } from 'next/server';

import { getAppPageRows } from '../db/recipe-page';
import { sourceDomainOf } from '../recipe/cook-text';
import { getDatabase } from '../util';
import { decodeCursor, pageBody, parseLimit, sliceAfter } from './pagination';
import { problems } from './problem';
import {
  comparePositions,
  filterRecipes,
  parseSort,
  positionOf,
  sortRecipes,
  type QueryableRecipe,
} from './recipe-query';
import { recipeSummary, type RecipeSummary } from './recipe-resource';

/**
 * One page of the user's recipes. `forced` adds filters the caller always wants
 * (the favourites collection forces `favourite=true`).
 */
export async function listRecipes(
  request: Request,
  userId: number,
  forced: Record<string, string> = {},
): Promise<NextResponse> {
  const query = new URL(request.url).searchParams;
  for (const [key, value] of Object.entries(forced)) {
    query.set(key, value);
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
  const rows: (QueryableRecipe & { summary: RecipeSummary })[] = recipes.map(
    (row) => {
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
    },
  );

  const sorted = sortRecipes(filterRecipes(rows, query), order);
  const page = sliceAfter(
    sorted,
    (r) => positionOf(r, order),
    comparePositions(order),
    after,
    limit,
  );
  return NextResponse.json(
    pageBody(
      request,
      page.items.map((r) => r.summary),
      page.next,
    ),
    { headers: { 'Cache-Control': 'private, no-cache' } },
  );
}
