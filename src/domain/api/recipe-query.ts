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
} from '@/domain/recipe/facet-filter';
import { compareText } from '@/lib/intl';
import type { CursorPosition } from '@/core/api';

/** A recipe as the query needs it. */
export interface QueryableRecipe extends FilterableRecipe {
  readonly id: string;
  readonly title: string;
  readonly modified_at?: string;
}

/** How a list is ordered. */
export interface SortOrder {
  readonly field: 'title' | 'modified_at';
  readonly descending: boolean;
}

/** Parse `sort` (`title`, `+title`, `-modified_at`…); undefined if invalid. */
export function parseSort(raw: string | null): SortOrder | undefined {
  const value = (raw ?? '+title').trim().replace(/^ /, '+');
  const match = /^(?<sign>[+-]?)(?<field>title|modified_at)$/.exec(value);
  const field = match?.groups?.['field'];
  return field === 'title' || field === 'modified_at'
    ? { field, descending: match?.groups?.['sign'] === '-' }
    : undefined;
}

/** The API's query parameters, translated to the filter engine's. */
export function toFilterParams(query: URLSearchParams): SearchParams {
  // Later occurrences of a key win, as with plain assignment.
  return Object.fromEntries(
    [...query.entries()].flatMap(([key, value]): [string, string][] => {
      if (key === 'q') {
        return [['q', value]];
      }
      if (key === 'source_site') {
        return [['site', value]];
      }
      if (key === 'favourite') {
        return [['fav', value === 'true' ? '1' : '0']];
      }
      // Facets (protein, cuisine, …) pass through under their own names.
      return PAGING_KEYS.includes(key) ? [] : [[key, value]];
    }),
  );
}

/** Query parameters that steer the page, not the filter. */
const PAGING_KEYS: readonly string[] = ['sort', 'cursor', 'limit'];

/** Keep the recipes that match the query's filters. */
export function filterRecipes<T extends QueryableRecipe>(
  recipes: readonly T[],
  query: URLSearchParams,
): readonly T[] {
  const state = parseFilters(toFilterParams(query));
  return recipes.filter((r) => matchesFilters(r, state));
}

/** The sort key of a recipe. */
function keyOf(recipe: Readonly<QueryableRecipe>, order: SortOrder): string {
  return order.field === 'title' ? recipe.title : (recipe.modified_at ?? '');
}

/** Sort recipes; ties break on id so the order (and cursors) are stable. */
export function sortRecipes<T extends QueryableRecipe>(
  recipes: readonly T[],
  order: SortOrder,
): readonly T[] {
  return recipes.toSorted(compareWith(order, (r: T) => positionOf(r, order)));
}

/** A recipe's cursor position under a sort order. */
export function positionOf(
  recipe: Readonly<QueryableRecipe>,
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

/** Lift a position comparison to compare whole items by their position. */
function compareWith<T>(
  order: SortOrder,
  position: (item: T) => CursorPosition,
): (a: T, b: T) => number {
  const cmp = comparePositions(order);
  return (a, b) => cmp(position(a), position(b));
}
