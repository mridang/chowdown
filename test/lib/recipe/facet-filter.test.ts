import { describe, expect, it } from '@jest/globals';

import {
  buildDomainFacet,
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

describe('source site filter', () => {
  const sited: FilterableRecipe[] = [
    { display: 'Soup', domain: 'a.com', tags: {} },
    { display: 'Stew', domain: 'a.com', tags: {} },
    { display: 'Salad', domain: 'b.com', tags: {} },
    { display: 'Toast', tags: {} },
  ];
  const names = (query: Record<string, string>) =>
    sited
      .filter((r) => matchesFilters(r, parseFilters(query)))
      .map((r) => r.display);

  it('reads ?site= as lower-cased sites', () => {
    expect(parseFilters({ site: 'A.com, b.com' }).domains).toEqual([
      'a.com',
      'b.com',
    ]);
    expect(parseFilters({}).domains).toEqual([]);
  });

  it('keeps only recipes from the chosen sites', () => {
    expect(names({ site: 'a.com' })).toEqual(['Soup', 'Stew']);
    expect(names({ site: 'a.com,b.com' })).toEqual(['Soup', 'Stew', 'Salad']);
  });

  it('drops recipes with no site when a site is chosen', () => {
    expect(names({ site: 'b.com' })).toEqual(['Salad']);
  });

  it('matches the site in free-text search', () => {
    expect(names({ q: 'b.com' })).toEqual(['Salad']);
  });

  it('offers only sites with several recipes, busiest first', () => {
    const facet = buildDomainFacet(sited, parseFilters({}));
    expect(facet?.key).toBe('site');
    expect(facet?.values).toEqual([
      { value: 'a.com', count: 2, active: false },
    ]);
  });

  it('keeps a selected site listed so it can be switched off', () => {
    const facet = buildDomainFacet(sited, parseFilters({ site: 'b.com' }));
    expect(facet?.values.map((v) => [v.value, v.active])).toEqual([
      ['a.com', false],
      ['b.com', true],
    ]);
  });

  it('is null when no site qualifies', () => {
    expect(
      buildDomainFacet([sited[2]!, sited[3]!], parseFilters({})),
    ).toBeNull();
  });
});

describe('accent-insensitive search', () => {
  const list: FilterableRecipe[] = [
    { display: 'Crème brûlée', tags: {} },
    { display: 'Albóndigas Mexicanas', tags: { cuisine: ['Mexican'] } },
    { display: 'Salad', tags: {} },
  ];
  const find = (q: string) =>
    list
      .filter((r) => matchesFilters(r, parseFilters({ q })))
      .map((r) => r.display);

  it('finds accented titles from plain letters, in any case', () => {
    expect(find('creme')).toEqual(['Crème brûlée']);
    expect(find('ALBONDIGAS')).toEqual(['Albóndigas Mexicanas']);
  });

  it('finds plain titles from accented input', () => {
    expect(find('sálad')).toEqual(['Salad']);
  });
});
