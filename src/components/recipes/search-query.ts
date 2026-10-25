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

import type { CardRecipe } from '@/domain/recipe/card-data';
import { DIET_TYPES } from '@/domain/recipe/diet-type';
import { sentenceCase } from '@/utils/text';
import { compareText, foldText } from '@/lib/intl';

/** The query-string bag Next gives a page. */
export type RawParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

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

/** The name of one filter, e.g. `protein`; also its parameter in the URL. */
export type FacetKey = (typeof FACET_KEYS)[number];

/** The orders the list can take, each as its URL value and its menu label. */
export const SORTS = [
  ['title', 'Title A–Z'],
  ['time', 'Quickest first'],
  ['easy', 'Easiest first'],
] as const;

/** The URL value of one of the orders in {@link SORTS}. */
export type SortKey = (typeof SORTS)[number][0];

/**
 * Everything the URL says about what to show: the search text, whether only
 * favourites are wanted, the order, how many results to show, and the values
 * switched on for each filter.
 */
export interface Query {
  readonly q: string;
  readonly favourites: boolean;
  readonly sort: SortKey;
  readonly limit: number;
  readonly selected: Readonly<Partial<Record<FacetKey, readonly string[]>>>;
}

/** How long a recipe takes, in the buckets the Time filter offers. */
export const TIME_BUCKETS = [
  ['15', 'Up to 15 min'],
  ['30', '16–30 min'],
  ['60', '31–60 min'],
  ['long', 'Over an hour'],
] as const;

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

/** Difficulty levels from easiest to hardest, the order they sort and list in. */
const DIFFICULTY_ORDER: readonly string[] = ['Easy', 'Medium', 'Hard'];

/** The Time buckets in the order they list in. */
const TIME_ORDER: readonly string[] = TIME_BUCKETS.map(([value]) => value);

/** How many recipes the list shows at a time; Show more adds this many. */
export const PAGE_SIZE = 24;

/** A source site needs at least this many recipes to be offered as a filter. */
const SITE_MIN = 2;

/** The first value of a query parameter that may have been repeated. */
function first(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === 'string' || value === undefined ? value : value[0];
}

/** Whether `value` is one of the orders the list can take. */
function isSortKey(value: string | undefined): value is SortKey {
  return SORTS.some(([key]) => key === value);
}

/** The comma-separated values of one filter in the URL, trimmed, blanks dropped. */
function selectedValues(params: RawParams, key: FacetKey): readonly string[] {
  return (first(params[key]) ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Read the query from the URL. */
export function parseQuery(params: RawParams): Query {
  const sort = first(params['sort']);
  const limit = Number(first(params['limit']));
  return {
    q: (first(params['q']) ?? '').trim(),
    favourites: first(params['fav']) === '1',
    sort: isSortKey(sort) ? sort : 'title',
    limit: Number.isInteger(limit) && limit >= PAGE_SIZE ? limit : PAGE_SIZE,
    // A filter with no values is left out, so "nothing chosen" is a missing key.
    selected: Object.fromEntries(
      FACET_KEYS.map(
        (key) => [key, selectedValues(params, key)] as const,
      ).filter(([, values]) => values.length > 0),
    ),
  };
}

/** The values a recipe has for a filter; a fact it lacks gives none. */
export function valuesOf(recipe: CardRecipe, key: FacetKey): readonly string[] {
  const values = ((): readonly (string | undefined)[] => {
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

/**
 * Whether a recipe has the words in the search box. Every word must appear
 * somewhere, in any order, so "chicken curry" finds "Curry with chicken" as
 * well as a title that holds the phrase.
 */
function matchesText(recipe: CardRecipe, text: string): boolean {
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
  return foldText(text)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Whether a recipe has any of the wanted values for a filter. Compared without
 * regard to case, so a hand-typed `?protein=Chicken` works.
 */
function matchesFacet(
  recipe: CardRecipe,
  key: FacetKey,
  wanted: readonly string[],
): boolean {
  const have = valuesOf(recipe, key).map((v) => v.toLowerCase());
  return wanted.some((v) => have.includes(v.toLowerCase()));
}

/** Whether a recipe passes every part of the query. */
export function matches(recipe: CardRecipe, query: Query): boolean {
  if (query.favourites && !recipe.favourite) {
    return false;
  }
  if (query.q && !matchesText(recipe, query.q)) {
    return false;
  }
  return FACET_KEYS.every((key) => {
    const wanted = query.selected[key];
    // A filter with nothing chosen lets everything through.
    return !wanted || wanted.length === 0 || matchesFacet(recipe, key, wanted);
  });
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

/**
 * How each order compares two recipes. Every order falls back to title so the
 * list never shuffles between visits.
 */
const COMPARATORS = {
  title: byTitle,
  time: (a, b) => byMinutes(a, b) || byTitle(a, b),
  easy: (a, b) => byDifficulty(a, b) || byMinutes(a, b) || byTitle(a, b),
} as const satisfies Record<SortKey, (a: CardRecipe, b: CardRecipe) => number>;

/** Order recipes; every order falls back to title so the list never shuffles. */
export function sortRecipes(
  recipes: readonly CardRecipe[],
  sort: SortKey,
): readonly CardRecipe[] {
  return recipes.toSorted(COMPARATORS[sort]);
}

/** The URL for a query, leaving out anything at its default. */
export function hrefFor(query: Query): string {
  const pairs: readonly (readonly [string, string])[] = [
    ...(query.q ? [['q', query.q] as const] : []),
    ...(query.favourites ? [['fav', '1'] as const] : []),
    ...(query.sort !== 'title' ? [['sort', query.sort] as const] : []),
    ...FACET_KEYS.flatMap((key) => {
      const values = query.selected[key];
      return values?.length ? [[key, values.join(',')] as const] : [];
    }),
  ];
  const qs = new URLSearchParams(Object.fromEntries(pairs)).toString();
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

/** What a filter value is called on screen: a time bucket by its range, a site as it is, the rest in sentence case. */
function labelFor(key: FacetKey, value: string): string {
  switch (key) {
    case 'time':
      return TIME_BUCKETS.find(([v]) => v === value)?.[1] ?? value;
    case 'site':
      return value;
    default:
      return sentenceCase(value);
  }
}

/** An active filter's label and the link that removes it. */
export interface ActiveFilter {
  readonly label: string;
  readonly href: string;
}

/** Every active filter as a labelled chip with the link that removes it. */
export function activeFilters(query: Query): readonly ActiveFilter[] {
  return [
    ...(query.favourites
      ? [
          {
            label: 'Favourites',
            href: hrefFor({ ...query, favourites: false }),
          },
        ]
      : []),
    ...FACET_KEYS.flatMap((key) =>
      (query.selected[key] ?? []).map((value) => ({
        label: labelFor(key, value),
        href: hrefFor(toggled(query, key, value)),
      })),
    ),
  ];
}

/** One value in a filter: its label, how many recipes have it, and whether it is on. */
export interface FacetOptionData {
  readonly value: string;
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly href: string;
}

/** One filter as the panel shows it: its heading and the values on offer. */
export interface FacetData {
  readonly key: FacetKey;
  readonly title: string;
  readonly options: readonly FacetOptionData[];
}

/** The heading each filter shows in the panel. */
const TITLES = {
  difficulty: 'Difficulty',
  time: 'Time',
  protein: 'Protein',
  cuisine: 'Cuisine',
  category: 'Course',
  diet_type: 'Diet',
  diet: 'Dietary needs',
  method: 'Method',
  site: 'Source',
} as const satisfies Record<FacetKey, string>;

/** A value of a filter and how many recipes have it. */
type Count = readonly [value: string, count: number];

/** How many recipes have each value of a filter, in the order first met. */
function countValues(
  recipes: readonly CardRecipe[],
  key: FacetKey,
): readonly Count[] {
  const groups = Map.groupBy(
    recipes.flatMap((recipe) => valuesOf(recipe, key)),
    (value) => value,
  );
  return [...groups].map(([value, found]) => [value, found.length] as const);
}

/** Comparing two counts by where their value sits in a fixed list. */
function byListOrder(order: readonly string[]) {
  return (a: Count, b: Count): number =>
    order.indexOf(a[0]) - order.indexOf(b[0]);
}

/** Most recipes first; equal counts fall back to alphabetical. */
function byPopularity(a: Count, b: Count): number {
  return b[1] - a[1] || a[0].localeCompare(b[0]);
}

/** How a filter's values are ordered: difficulty, time and diet follow their natural order, the rest by popularity. */
function orderFor(key: FacetKey): (a: Count, b: Count) => number {
  switch (key) {
    case 'difficulty':
      return byListOrder(DIFFICULTY_ORDER);
    case 'time':
      return byListOrder(TIME_ORDER);
    case 'diet_type':
      return byListOrder(DIET_TYPES);
    default:
      return byPopularity;
  }
}

/** Build every filter's options, with counts over the whole collection. */
export function buildFacets(
  recipes: readonly CardRecipe[],
  query: Query,
): readonly FacetData[] {
  return FACET_KEYS.map((key) => {
    const chosen = query.selected[key] ?? [];
    const counted = countValues(recipes, key);
    // A source site needs a few recipes to be worth offering, unless it is
    // already switched on (so it can be switched off again).
    const offered =
      key === 'site'
        ? counted.filter(
            ([value, n]) => n >= SITE_MIN || chosen.includes(value),
          )
        : counted;
    return {
      key,
      title: TITLES[key],
      options: offered.toSorted(orderFor(key)).map(([value, count]) => ({
        value,
        label: labelFor(key, value),
        count,
        active: chosen.includes(value),
        href: hrefFor(toggled(query, key, value)),
      })),
    };
  }).filter((facet) => facet.options.length > 0);
}
