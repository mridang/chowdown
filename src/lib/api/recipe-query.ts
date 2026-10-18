/**
 * @packageDocumentation
 *
 * The recipe collection's query language, in API terms. The filters are the
 * same ones the app's own list uses, under REST-style names: `q`, one parameter
 * per facet (comma-separated values mean "any of"), `source_site`, `favourite`,
 * and `sort`.
 */

import {
  matchesFilters,
  parseFilters,
  type FilterableRecipe,
  type SearchParams,
} from '../recipe/facet-filter';
import { compareText } from '../intl';
import type { CursorPosition } from './pagination';

/** A recipe as the query needs it. */
export interface QueryableRecipe extends FilterableRecipe {
  id: string;
  title: string;
  modified_at?: string;
}

/** How a list is ordered. */
export interface SortOrder {
  field: 'title' | 'modified_at';
  descending: boolean;
}

/** Parse `sort` (`title`, `+title`, `-modified_at`…); undefined if invalid. */
export function parseSort(raw: string | null): SortOrder | undefined {
  const value = (raw ?? '+title').trim().replace(/^ /, '+');
  const match = /^([+-]?)(title|modified_at)$/.exec(value);
  return match
    ? {
        field: match[2] as SortOrder['field'],
        descending: match[1] === '-',
      }
    : undefined;
}

/** The API's query parameters, translated to the filter engine's. */
export function toFilterParams(query: URLSearchParams): SearchParams {
  const params: SearchParams = {};
  for (const [key, value] of query.entries()) {
    if (key === 'q') {
      params['q'] = value;
    } else if (key === 'source_site') {
      params['site'] = value;
    } else if (key === 'favourite') {
      params['fav'] = value === 'true' ? '1' : '0';
    } else if (!['sort', 'cursor', 'limit'].includes(key)) {
      params[key] = value; // facets: protein, cuisine, …
    }
  }
  return params;
}

/** Keep the recipes that match the query's filters. */
export function filterRecipes<T extends QueryableRecipe>(
  recipes: T[],
  query: URLSearchParams,
): T[] {
  const state = parseFilters(toFilterParams(query));
  return recipes.filter((r) => matchesFilters(r, state));
}

/** The sort key of a recipe. */
function keyOf(recipe: QueryableRecipe, order: SortOrder): string {
  return order.field === 'title' ? recipe.title : (recipe.modified_at ?? '');
}

/** Sort recipes; ties break on id so the order (and cursors) are stable. */
export function sortRecipes<T extends QueryableRecipe>(
  recipes: T[],
  order: SortOrder,
): T[] {
  return [...recipes].sort(compareWith(order, (r: T) => positionOf(r, order)));
}

/** A recipe's cursor position under a sort order. */
export function positionOf(
  recipe: QueryableRecipe,
  order: SortOrder,
): CursorPosition {
  return { key: keyOf(recipe, order), id: recipe.id };
}

/** Compare two positions the way the list is sorted. */
export function comparePositions(
  order: SortOrder,
): (a: CursorPosition, b: CursorPosition) => number {
  // Titles order the way a person would alphabetise them (accents and case
  // ignored, numbers by value); timestamps are ISO strings, which already
  // order correctly as plain text. Ties fall to the id so order stays stable.
  const compareKeys =
    order.field === 'title'
      ? compareText
      : (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  return (a, b) => {
    const byKey = compareKeys(a.key, b.key);
    const base = byKey !== 0 ? byKey : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return order.descending ? -base : base;
  };
}

function compareWith<T>(
  order: SortOrder,
  position: (item: T) => CursorPosition,
): (a: T, b: T) => number {
  const cmp = comparePositions(order);
  return (a, b) => cmp(position(a), position(b));
}
