/**
 * @packageDocumentation
 *
 * The recipe list's query language, in URL form so every filter is a link:
 * `?protein=chicken,beef&time=15,30&diet_type=Vegetarian&sort=time`. Several
 * values for one filter mean "any of"; different filters combine with "and".
 *
 * Recipes can lack facts (many saved pages have no time, difficulty or protein).
 * A missing fact is never counted, offered or matched as a value: such a recipe
 * simply has no value for that filter, and sorts after the ones that do.
 */

import type { CardRecipe } from '../../lib/recipe/card-data';
import { DIET_TYPES } from '../../lib/recipe/diet-type';
import { sentenceCase } from '../../lib/format';
import { compareText, foldText } from '../../lib/intl';

/** The query-string bag Next gives a page. */
export type RawParams = Record<string, string | string[] | undefined>;

/** The filters that offer a list of values. */
export const FACET_KEYS = [
  'difficulty',
  'time',
  'protein',
  'cuisine',
  'category',
  'diet_type',
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

/** How many recipes the list shows at a time; Show more adds this many. */
export const PAGE_SIZE = 24;

/** A source site needs at least this many recipes to be offered as a filter. */
const SITE_MIN = 2;

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

/** The values a recipe has for a filter; a fact it lacks gives none. */
export function valuesOf(recipe: CardRecipe, key: FacetKey): string[] {
  const values = ((): (string | undefined)[] => {
    switch (key) {
      case 'difficulty':
        return [recipe.difficulty];
      case 'time':
        return [
          recipe.minutes === undefined ? undefined : timeBucket(recipe.minutes),
        ];
      case 'protein':
        return [recipe.protein];
      case 'cuisine':
        return [recipe.cuisine];
      case 'category':
        return [recipe.category];
      case 'diet_type':
        return [recipe.dietType];
      case 'diet':
        return recipe.diet;
      case 'method':
        return recipe.method;
      case 'site':
        return [recipe.site];
    }
  })();
  return values.filter((v): v is string => Boolean(v));
}

/** Whether a recipe passes every part of the query. */
export function matches(recipe: CardRecipe, query: Query): boolean {
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
        recipe.category,
        ...recipe.keywords,
      ].join(' '),
    );
    // Every word must appear somewhere, in any order, so "chicken curry" finds
    // "Curry with chicken" as well as a title that holds the phrase.
    const words = foldText(query.q).split(/\s+/).filter(Boolean);
    if (!words.every((word) => haystack.includes(word))) {
      return false;
    }
  }
  for (const key of FACET_KEYS) {
    const wanted = query.selected[key];
    if (wanted && wanted.length > 0) {
      // Compared without regard to case, so a hand-typed `?protein=Chicken` works.
      const have = valuesOf(recipe, key).map((v) => v.toLowerCase());
      if (!wanted.some((v) => have.includes(v.toLowerCase()))) {
        return false;
      }
    }
  }
  return true;
}

/** Title order, the way a person would alphabetise it; ties fall back to the id. */
function byTitle(a: CardRecipe, b: CardRecipe): number {
  return compareText(a.title, b.title) || a.id.localeCompare(b.id);
}

/** Smaller first, with a missing number after every real one. */
function byMinutes(a: CardRecipe, b: CardRecipe): number {
  return (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || 0;
}

/** Easy before Hard, with an unrated recipe after every rated one. */
function byDifficulty(a: CardRecipe, b: CardRecipe): number {
  const rank = (r: CardRecipe) =>
    r.difficulty ? DIFFICULTY_ORDER.indexOf(r.difficulty) : Infinity;
  return rank(a) - rank(b) || 0;
}

/** Order recipes; every order falls back to title so the list never shuffles. */
export function sortRecipes(
  recipes: CardRecipe[],
  sort: SortKey,
): CardRecipe[] {
  const list = [...recipes];
  if (sort === 'time') {
    return list.sort((a, b) => byMinutes(a, b) || byTitle(a, b));
  }
  if (sort === 'easy') {
    return list.sort(
      (a, b) => byDifficulty(a, b) || byMinutes(a, b) || byTitle(a, b),
    );
  }
  return list.sort(byTitle);
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
  return qs ? `/app?${qs}` : '/app';
}

/** The URL that shows the next page of the same results. */
export function moreHref(query: Query): string {
  const base = hrefFor(query);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}limit=${query.limit + PAGE_SIZE}`;
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
          : key === 'site'
            ? value
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
  diet_type: 'Diet',
  diet: 'Dietary needs',
  method: 'Method',
  site: 'Source',
};

/** Build every filter's options, with counts over the whole collection. */
export function buildFacets(recipes: CardRecipe[], query: Query): FacetData[] {
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
        ([value, n]) =>
          n >= SITE_MIN || (query.selected.site ?? []).includes(value),
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
          : key === 'diet_type'
            ? (a: [string, number], b: [string, number]) =>
                DIET_TYPES.indexOf(a[0] as (typeof DIET_TYPES)[number]) -
                DIET_TYPES.indexOf(b[0] as (typeof DIET_TYPES)[number])
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
