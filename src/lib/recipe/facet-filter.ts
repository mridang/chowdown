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
  q: string;
  /** Show only hearted recipes (`?fav=1`). */
  favouritesOnly: boolean;
  /** `{ facetKey: selectedValue[] }`. */
  selected: Record<string, string[]>;
  /** Source sites to show (`?site=a.com,b.com`), already lower-cased. */
  domains: string[];
}

/** The query-string key (and facet key) for the source-site filter. */
export const DOMAIN_KEY = 'site';

/** A site needs at least this many recipes to be offered as a filter. */
export const MIN_DOMAIN_RECIPES = 2;

/** A query-string params bag (Next's `searchParams`, already awaited). */
export type SearchParams = Record<string, string | string[] | undefined>;

/** Split a param (string, CSV, or repeated) into trimmed, non-empty values. */
function paramValues(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Read the free-text query and selected facet values from the query string. */
export function parseFilters(params: SearchParams): FilterState {
  const q = typeof params['q'] === 'string' ? params['q'].trim() : '';
  const selected: Record<string, string[]> = {};
  for (const f of FACETS) {
    const vals = paramValues(params[f.key]);
    if (vals.length > 0) {
      selected[f.key] = vals;
    }
  }
  const fav = params['fav'];
  const favouritesOnly = fav === '1' || fav === 'true';
  const domains = paramValues(params[DOMAIN_KEY]).map((d) => d.toLowerCase());
  return { q, favouritesOnly, selected, domains };
}

/** A recipe as far as filtering cares: a display name and its tags. */
export interface FilterableRecipe {
  display: string;
  /** Whether the user has hearted it. */
  favourite?: boolean;
  /** The site its `>> source:` came from, e.g. `seriouseats.com`. */
  domain?: string;
  tags: RecipeTags;
}

/** Whether a recipe passes the filter state (AND across facets, OR within). */
export function matchesFilters(
  recipe: FilterableRecipe,
  state: FilterState,
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

/** Count how many recipes carry each value, per facet (for the sidebar). */
export function facetCounts(
  recipes: FilterableRecipe[],
): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {};
  for (const f of FACETS) {
    counts[f.key] = {};
  }
  for (const r of recipes) {
    for (const f of FACETS) {
      for (const v of r.tags[f.key] ?? []) {
        counts[f.key]![v] = (counts[f.key]![v] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/** A facet value as the sidebar renders it. */
export interface FacetValueView {
  value: string;
  count: number;
  active: boolean;
}

/** A facet as the sidebar renders it. */
export interface FacetView {
  key: string;
  label: string;
  values: FacetValueView[];
}

/**
 * Build the sidebar view: one entry per closed facet that has at least one
 * tagged value, each value stamped with its count and whether it's active.
 * The open `keywords` facet is excluded — it's free-form, not a good facet UI.
 */
export function buildFacetView(
  counts: Record<string, Record<string, number>>,
  state: FilterState,
): FacetView[] {
  const views: FacetView[] = [];
  for (const f of FACETS) {
    if (f.values === null) {
      continue; // skip open keywords facet
    }
    const entries = Object.entries(counts[f.key] ?? {});
    if (entries.length === 0) {
      continue;
    }
    const active = state.selected[f.key] ?? [];
    views.push({
      key: f.key,
      label: f.label,
      values: entries
        .sort(([a], [b]) =>
          f.ordered
            ? f.values!.indexOf(a) - f.values!.indexOf(b)
            : a.localeCompare(b),
        )
        .map(([value, count]) => ({
          value,
          count,
          active: active.some((v) => v.toLowerCase() === value.toLowerCase()),
        })),
    });
  }
  return views;
}

/**
 * The "Source" facet: the sites that more than one recipe came from, busiest
 * first. A site the user has already selected stays listed even if it has
 * fewer recipes, so it can always be switched off. Null when there is nothing
 * worth offering.
 */
export function buildDomainFacet(
  recipes: FilterableRecipe[],
  state: FilterState,
): FacetView | null {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    if (r.domain) {
      counts.set(r.domain, (counts.get(r.domain) ?? 0) + 1);
    }
  }
  const values = [...counts.entries()]
    .filter(
      ([domain, count]) =>
        count >= MIN_DOMAIN_RECIPES || state.domains.includes(domain),
    )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      count,
      active: state.domains.includes(value),
    }));
  return values.length > 0
    ? { key: DOMAIN_KEY, label: 'Source', values }
    : null;
}
