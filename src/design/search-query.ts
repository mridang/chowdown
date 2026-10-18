/**
 * @packageDocumentation
 *
 * The recipe list's query language for the design sandbox, in URL form so every
 * filter is a link: `?protein=chicken,beef&time=quick&diet=Vegetarian&sort=time`.
 * Several values for one filter mean "any of"; different filters combine with
 * "and". This mirrors how the real app's filters work.
 */

import { foldText } from '@/lib/intl';

import type { SampleRecipe } from './fixtures';
import { sentenceCase } from './format';

/** The query-string bag Next gives a page. */
export type RawParams = Record<string, string | string[] | undefined>;

/** The filters that offer a list of values. */
export const FACET_KEYS = [
  'difficulty',
  'time',
  'protein',
  'cuisine',
  'category',
  'diet',
  'method',
  'site',
] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export const SORTS = [
  ['title', 'Title A–Z'],
  ['time', 'Quickest first'],
  ['easy', 'Easiest first'],
] as const;
export type SortKey = (typeof SORTS)[number][0];

export interface Query {
  q: string;
  favourites: boolean;
  sort: SortKey;
  limit: number;
  selected: Partial<Record<FacetKey, string[]>>;
}

/** How long a recipe takes, in the buckets the Time filter offers. */
export const TIME_BUCKETS: [string, string][] = [
  ['15', 'Up to 15 min'],
  ['30', '16–30 min'],
  ['60', '31–60 min'],
  ['long', 'Over an hour'],
];

/** The Time bucket a number of minutes falls in. */
export function timeBucket(minutes: number): string {
  if (minutes <= 15) {
    return '15';
  }
  if (minutes <= 30) {
    return '30';
  }
  return minutes <= 60 ? '60' : 'long';
}

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const PAGE_SIZE = 24;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Read the query from the URL. */
export function parseQuery(params: RawParams): Query {
  const selected: Query['selected'] = {};
  for (const key of FACET_KEYS) {
    const values = (first(params[key]) ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length > 0) {
      selected[key] = values;
    }
  }
  const sort = first(params['sort']);
  const limit = Number(first(params['limit']));
  return {
    q: (first(params['q']) ?? '').trim(),
    favourites: first(params['fav']) === '1',
    sort: SORTS.some(([k]) => k === sort) ? (sort as SortKey) : 'title',
    limit: Number.isInteger(limit) && limit >= PAGE_SIZE ? limit : PAGE_SIZE,
    selected,
  };
}

/** The values a recipe has for a filter. */
export function valuesOf(recipe: SampleRecipe, key: FacetKey): string[] {
  switch (key) {
    case 'difficulty':
      return [recipe.difficulty];
    case 'time':
      return [timeBucket(recipe.minutes)];
    case 'protein':
      return [recipe.protein];
    case 'cuisine':
      return [recipe.cuisine];
    case 'category':
      return [recipe.category];
    case 'diet':
      return recipe.diet;
    case 'method':
      return recipe.method;
    case 'site':
      return [recipe.site];
  }
}

/** Whether a recipe passes every part of the query. */
export function matches(recipe: SampleRecipe, query: Query): boolean {
  if (query.favourites && !recipe.favourite) {
    return false;
  }
  if (query.q) {
    const haystack = foldText(
      [
        recipe.title,
        recipe.site,
        recipe.cuisine,
        recipe.protein,
        ...recipe.keywords,
      ].join(' '),
    );
    if (!haystack.includes(foldText(query.q))) {
      return false;
    }
  }
  for (const key of FACET_KEYS) {
    const wanted = query.selected[key];
    if (wanted && !valuesOf(recipe, key).some((v) => wanted.includes(v))) {
      return false;
    }
  }
  return true;
}

/** Order recipes. */
export function sortRecipes(
  recipes: SampleRecipe[],
  sort: SortKey,
): SampleRecipe[] {
  const list = [...recipes];
  if (sort === 'time') {
    return list.sort((a, b) => a.minutes - b.minutes);
  }
  if (sort === 'easy') {
    return list.sort(
      (a, b) =>
        DIFFICULTY_ORDER.indexOf(a.difficulty) -
          DIFFICULTY_ORDER.indexOf(b.difficulty) || a.minutes - b.minutes,
    );
  }
  return list; // already sorted by title
}

/** The URL for a query, leaving out anything at its default. */
export function hrefFor(query: Query): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set('q', query.q);
  }
  if (query.favourites) {
    params.set('fav', '1');
  }
  if (query.sort !== 'title') {
    params.set('sort', query.sort);
  }
  for (const key of FACET_KEYS) {
    const values = query.selected[key];
    if (values?.length) {
      params.set(key, values.join(','));
    }
  }
  const qs = params.toString();
  return qs ? `/design/search?${qs}` : '/design/search';
}

/** The query with one value of one filter switched on or off. */
export function toggled(query: Query, key: FacetKey, value: string): Query {
  const current = query.selected[key] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { ...query, selected: { ...query.selected, [key]: next } };
}

/** Every active filter as a labelled chip with the link that removes it. */
export function activeFilters(query: Query): { label: string; href: string }[] {
  const chips: { label: string; href: string }[] = [];
  if (query.favourites) {
    chips.push({
      label: 'Favourites',
      href: hrefFor({ ...query, favourites: false }),
    });
  }
  for (const key of FACET_KEYS) {
    for (const value of query.selected[key] ?? []) {
      const label =
        key === 'time'
          ? (TIME_BUCKETS.find(([v]) => v === value)?.[1] ?? value)
          : sentenceCase(value);
      chips.push({ label, href: hrefFor(toggled(query, key, value)) });
    }
  }
  return chips;
}

/** One value in a filter: its label, how many recipes have it, and whether it is on. */
export interface FacetOptionData {
  value: string;
  label: string;
  count: number;
  active: boolean;
  href: string;
}

export interface FacetData {
  key: FacetKey;
  title: string;
  options: FacetOptionData[];
}

const TITLES: Record<FacetKey, string> = {
  difficulty: 'Difficulty',
  time: 'Time',
  protein: 'Protein',
  cuisine: 'Cuisine',
  category: 'Course',
  diet: 'Diet',
  method: 'Method',
  site: 'Source',
};

/** Build every filter's options, with counts over the whole collection. */
export function buildFacets(
  recipes: SampleRecipe[],
  query: Query,
): FacetData[] {
  return FACET_KEYS.map((key) => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const value of valuesOf(recipe, key)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    let entries = [...counts.entries()];
    if (key === 'site') {
      entries = entries.filter(
        ([value, n]) => n >= 2 || (query.selected.site ?? []).includes(value),
      );
    }
    const order =
      key === 'difficulty'
        ? (a: [string, number], b: [string, number]) =>
            DIFFICULTY_ORDER.indexOf(a[0]) - DIFFICULTY_ORDER.indexOf(b[0])
        : key === 'time'
          ? (a: [string, number], b: [string, number]) =>
              TIME_BUCKETS.findIndex(([v]) => v === a[0]) -
              TIME_BUCKETS.findIndex(([v]) => v === b[0])
          : (a: [string, number], b: [string, number]) =>
              b[1] - a[1] || a[0].localeCompare(b[0]);
    entries.sort(order);
    return {
      key,
      title: TITLES[key],
      options: entries.map(([value, count]) => ({
        value,
        label:
          key === 'time'
            ? (TIME_BUCKETS.find(([v]) => v === value)?.[1] ?? value)
            : key === 'site'
              ? value
              : sentenceCase(value),
        count,
        active: (query.selected[key] ?? []).includes(value),
        href: hrefFor(toggled(query, key, value)),
      })),
    };
  }).filter((facet) => facet.options.length > 0);
}
