/**
 * @packageDocumentation
 *
 * Pure facet-filtering logic for the app's recipe list, shared by the SSR page
 * (which filters) and unit tests. Filters come from the URL query string, so
 * the filtered list is server-rendered and shareable/bookmarkable.
 *
 * Semantics: AND across facets, OR within a facet (the usual e-commerce facet
 * behaviour) — e.g. `protein=chicken,beef & cuisine=Indian` means
 * "(chicken OR beef) AND Indian". The free-text `q` matches the recipe name
 * and any tag value.
 */

import { foldText } from '../intl';
import { FACETS } from './taxonomy';
import type { RecipeTags } from './tag-index';

/** Parsed filter state from the query string. */
export interface FilterState {
  readonly q: string;
  /** Show only hearted recipes (`?fav=1`). */
  readonly favouritesOnly: boolean;
  /** `{ facetKey: selectedValue[] }`. */
  readonly selected: Readonly<Record<string, readonly string[]>>;
  /** Source sites to show (`?site=a.com,b.com`), already lower-cased. */
  readonly domains: readonly string[];
}

/** The query-string key (and facet key) for the source-site filter. */
export const DOMAIN_KEY = 'site';

/** A site needs at least this many recipes to be offered as a filter. */
export const MIN_DOMAIN_RECIPES = 2;

/** A query-string params bag (Next's `searchParams`, already awaited). */
export type SearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/** Split a param (string, CSV, or repeated) into trimmed, non-empty values. */
function paramValues(
  raw: string | readonly string[] | undefined,
): readonly string[] {
  const list = typeof raw === 'string' ? [raw] : (raw ?? []);
  return list
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Read the free-text query and selected facet values from the query string. */
export function parseFilters(params: SearchParams): FilterState {
  const q = typeof params['q'] === 'string' ? params['q'].trim() : '';
  const selected = Object.fromEntries(
    FACETS.flatMap((f) => {
      const vals = paramValues(params[f.key]);
      return vals.length > 0 ? [[f.key, vals] as const] : [];
    }),
  );
  const fav = params['fav'];
  const favouritesOnly = fav === '1' || fav === 'true';
  const domains = paramValues(params[DOMAIN_KEY]).map((d) => d.toLowerCase());
  return { q, favouritesOnly, selected, domains };
}

/** A recipe as far as filtering cares: a display name and its tags. */
export interface FilterableRecipe {
  readonly display: string;
  /** Whether the user has hearted it. */
  readonly favourite?: boolean;
  /** The site its `>> source:` came from, e.g. `seriouseats.com`. */
  readonly domain?: string;
  readonly tags: RecipeTags;
}

/** Whether a recipe passes the filter state (AND across facets, OR within). */
export function matchesFilters(
  recipe: Readonly<FilterableRecipe>,
  state: Readonly<FilterState>,
): boolean {
  if (state.favouritesOnly && !recipe.favourite) {
    return false;
  }
  if (state.q) {
    // Accent- and case-insensitive: "creme" finds "Crème brûlée". The name and
    // site match anywhere; tag values match from the start of a word, so
    // "vegetarian" does not pull in "Non-vegetarian".
    const q = foldText(state.q);
    const inName = foldText(
      `${recipe.display} ${recipe.domain ?? ''}`,
    ).includes(q);
    const inTags = Object.values(recipe.tags)
      .flat()
      .some((v) =>
        foldText(v)
          .split(/\s+/)
          .some((word) => word.startsWith(q)),
      );
    if (!inName && !inTags) {
      return false;
    }
  }
  if (
    state.domains.length > 0 &&
    !state.domains.includes(recipe.domain ?? '')
  ) {
    return false;
  }
  for (const [key, wanted] of Object.entries(state.selected)) {
    const have = (recipe.tags[key] ?? []).map((v) => v.toLowerCase());
    if (!wanted.some((w) => have.includes(w.toLowerCase()))) {
      return false;
    }
  }
  return true;
}

/** How many times each value appears, by value, in order of first appearance. */
function tally(values: readonly string[]): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(Object.groupBy(values, (v) => v)).map(([value, same]) => [
      value,
      same?.length ?? 0,
    ]),
  );
}

/** Per-facet value counts: `{ facetKey: { value: howManyRecipes } }`. */
export type FacetCounts = Readonly<
  Record<string, Readonly<Record<string, number>>>
>;

/** Count how many recipes carry each value, per facet (for the sidebar). */
export function facetCounts(
  recipes: readonly Readonly<FilterableRecipe>[],
): FacetCounts {
  return Object.fromEntries(
    FACETS.map((f) => [
      f.key,
      tally(recipes.flatMap((r) => r.tags[f.key] ?? [])),
    ]),
  );
}

/** A facet value as the sidebar renders it. */
export interface FacetValueView {
  readonly value: string;
  readonly count: number;
  readonly active: boolean;
}

/** A facet as the sidebar renders it. */
export interface FacetView {
  readonly key: string;
  readonly label: string;
  readonly values: readonly FacetValueView[];
}

/**
 * Build the sidebar view: one entry per closed facet that has at least one
 * tagged value, each value stamped with its count and whether it's active.
 * The open `keywords` facet is excluded — it's free-form, not a good facet UI.
 */
export function buildFacetView(
  counts: FacetCounts,
  state: Readonly<FilterState>,
): readonly FacetView[] {
  return FACETS.flatMap((f): readonly FacetView[] => {
    const allowed = f.values;
    if (allowed === null) {
      return []; // skip open keywords facet
    }
    const entries = Object.entries(counts[f.key] ?? {});
    if (entries.length === 0) {
      return [];
    }
    const active = state.selected[f.key] ?? [];
    return [
      {
        key: f.key,
        label: f.label,
        values: entries
          .toSorted(([a], [b]) =>
            f.ordered
              ? allowed.indexOf(a) - allowed.indexOf(b)
              : a.localeCompare(b),
          )
          .map(([value, count]) => ({
            value,
            count,
            active: active.some((v) => v.toLowerCase() === value.toLowerCase()),
          })),
      },
    ];
  });
}

/**
 * The "Source" facet: the sites that more than one recipe came from, busiest
 * first. A site the user has already selected stays listed even if it has
 * fewer recipes, so it can always be switched off. Null when there is nothing
 * worth offering.
 */
export function buildDomainFacet(
  recipes: readonly Readonly<FilterableRecipe>[],
  state: Readonly<FilterState>,
): FacetView | null {
  const domains = recipes.flatMap((r) => (r.domain ? [r.domain] : []));
  const counts = Map.groupBy(domains, (domain) => domain);
  const values = [...counts.entries()]
    .map(([domain, same]) => [domain, same.length] as const)
    .filter(
      ([domain, count]) =>
        count >= MIN_DOMAIN_RECIPES || state.domains.includes(domain),
    )
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      count,
      active: state.domains.includes(value),
    }));
  return values.length > 0
    ? { key: DOMAIN_KEY, label: 'Source', values }
    : null;
}
