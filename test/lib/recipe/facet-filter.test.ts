import { describe, expect, it } from '@jest/globals';

import {
  buildFacetView,
  facetCounts,
  matchesFilters,
  parseFilters,
  type FilterableRecipe,
} from '../../../src/lib/recipe/facet-filter';

const recipes: FilterableRecipe[] = [
  {
    display: 'Chicken Chettinad',
    tags: { protein: ['chicken'], cuisine: ['Indian'] },
  },
  {
    display: 'Guacamole',
    tags: { protein: ['vegetable'], cuisine: ['Mexican'] },
  },
  { display: 'Beef Tacos', tags: { protein: ['beef'], cuisine: ['Mexican'] } },
];

describe('parseFilters', () => {
  it('reads q and CSV facet params', () => {
    const state = parseFilters({
      q: ' curry ',
      protein: 'chicken,beef',
      cuisine: 'Indian',
    });
    expect(state.q).toBe('curry');
    expect(state.selected['protein']).toEqual(['chicken', 'beef']);
    expect(state.selected['cuisine']).toEqual(['Indian']);
  });
  it('reads repeated params too', () => {
    const state = parseFilters({ protein: ['chicken', 'beef'] });
    expect(state.selected['protein']).toEqual(['chicken', 'beef']);
  });
  it('is empty when nothing is set', () => {
    const state = parseFilters({});
    expect(state.q).toBe('');
    expect(state.selected).toEqual({});
  });
});

describe('matchesFilters', () => {
  it('matches free text against name and tags', () => {
    const state = parseFilters({ q: 'mexican' });
    expect(
      recipes.filter((r) => matchesFilters(r, state)).map((r) => r.display),
    ).toEqual(['Guacamole', 'Beef Tacos']);
  });
  it('ANDs across facets, ORs within a facet', () => {
    const state = parseFilters({ protein: 'chicken,beef', cuisine: 'Mexican' });
    // chicken OR beef, AND Mexican → only Beef Tacos
    expect(
      recipes.filter((r) => matchesFilters(r, state)).map((r) => r.display),
    ).toEqual(['Beef Tacos']);
  });
  it('returns everything when there are no filters', () => {
    const state = parseFilters({});
    expect(recipes.filter((r) => matchesFilters(r, state))).toHaveLength(3);
  });
});

describe('facetCounts + buildFacetView', () => {
  it('counts values per facet', () => {
    const counts = facetCounts(recipes);
    expect(counts['cuisine']!['Mexican']).toBe(2);
    expect(counts['protein']!['chicken']).toBe(1);
  });
  it('builds a sorted view with active flags and skips empty facets', () => {
    const state = parseFilters({ cuisine: 'Mexican' });
    const view = buildFacetView(facetCounts(recipes), state);
    const cuisine = view.find((f) => f.key === 'cuisine');
    expect(cuisine?.values.map((v) => v.value)).toEqual(['Indian', 'Mexican']);
    expect(cuisine?.values.find((v) => v.value === 'Mexican')?.active).toBe(
      true,
    );
    // Difficulty has no tagged values here, so it isn't shown.
    expect(view.find((f) => f.key === 'difficulty')).toBeUndefined();
  });
});

describe('favourites filter', () => {
  const withHearts: FilterableRecipe[] = [
    { display: 'A', favourite: true, tags: { cuisine: ['Indian'] } },
    { display: 'B', favourite: false, tags: { cuisine: ['Indian'] } },
    { display: 'C', tags: { cuisine: ['Mexican'] } },
  ];

  it('reads ?fav=1 (and true) from the query string', () => {
    expect(parseFilters({ fav: '1' }).favouritesOnly).toBe(true);
    expect(parseFilters({ fav: 'true' }).favouritesOnly).toBe(true);
    expect(parseFilters({ fav: '0' }).favouritesOnly).toBe(false);
    expect(parseFilters({}).favouritesOnly).toBe(false);
  });

  it('keeps only hearted recipes when on', () => {
    const state = parseFilters({ fav: '1' });
    expect(
      withHearts.filter((r) => matchesFilters(r, state)).map((r) => r.display),
    ).toEqual(['A']);
  });

  it('combines with the facets (AND)', () => {
    const state = parseFilters({ fav: '1', cuisine: 'Mexican' });
    expect(withHearts.filter((r) => matchesFilters(r, state))).toEqual([]);
  });

  it('shows everything when off', () => {
    expect(
      withHearts.filter((r) => matchesFilters(r, parseFilters({}))),
    ).toHaveLength(3);
  });
});
