import { describe, expect, it } from '@jest/globals';

import {
  comparePositions,
  filterRecipes,
  parseSort,
  positionOf,
  sortRecipes,
  toFilterParams,
  type QueryableRecipe,
} from '@/lib/api/recipe-query';

const recipe = (
  id: string,
  title: string,
  extra: Partial<QueryableRecipe> = {},
): QueryableRecipe => ({
  id,
  title,
  display: title,
  favourite: false,
  tags: {},
  ...extra,
});

const q = (query: string) => new URLSearchParams(query);

describe('parseSort', () => {
  it('defaults to title ascending', () => {
    expect(parseSort(null)).toEqual({ field: 'title', descending: false });
  });

  it('reads direction prefixes, treating a decoded + as ascending', () => {
    expect(parseSort('-title')).toEqual({ field: 'title', descending: true });
    expect(parseSort('+modified_at')).toEqual({
      field: 'modified_at',
      descending: false,
    });
    expect(parseSort(' modified_at')).toEqual({
      field: 'modified_at',
      descending: false,
    });
  });

  it('rejects unknown fields', () => {
    expect(parseSort('popularity')).toBeUndefined();
    expect(parseSort('title;drop')).toBeUndefined();
  });
});

describe('toFilterParams', () => {
  it('maps API names onto the filter engine and keeps facets', () => {
    expect(
      toFilterParams(
        q(
          'q=soup&source_site=a.com&favourite=true&protein=chicken,beef&limit=5&sort=title&cursor=x',
        ),
      ),
    ).toEqual({ q: 'soup', site: 'a.com', fav: '1', protein: 'chicken,beef' });
  });

  it('turns favourite=false into not filtering', () => {
    expect(toFilterParams(q('favourite=false'))).toEqual({ fav: '0' });
  });
});

describe('filterRecipes', () => {
  const recipes = [
    recipe('1', 'Chicken curry', {
      tags: { protein: ['chicken'] },
      domain: 'a.com',
      favourite: true,
    }),
    recipe('2', 'Beef stew', { tags: { protein: ['beef'] }, domain: 'b.com' }),
    recipe('3', 'Salad'),
  ];
  const ids = (query: string) =>
    filterRecipes(recipes, q(query)).map((r) => r.id);

  it('filters by search text, facet, site and favourite', () => {
    expect(ids('q=stew')).toEqual(['2']);
    expect(ids('protein=chicken,beef')).toEqual(['1', '2']);
    expect(ids('source_site=b.com')).toEqual(['2']);
    expect(ids('favourite=true')).toEqual(['1']);
  });

  it('returns everything with no filters', () => {
    expect(ids('')).toEqual(['1', '2', '3']);
  });
});

describe('sortRecipes', () => {
  const recipes = [
    recipe('2', 'banana'),
    recipe('3', 'Apple'),
    recipe('1', 'apple'),
  ];

  it('sorts case-insensitively and breaks ties on id', () => {
    const sorted = sortRecipes(recipes, { field: 'title', descending: false });
    expect(sorted.map((r) => r.id)).toEqual(['1', '3', '2']);
  });

  it('reverses for descending, and orders cursor positions the same way', () => {
    const order = { field: 'title' as const, descending: true };
    const sorted = sortRecipes(recipes, order);
    expect(sorted.map((r) => r.id)).toEqual(['2', '3', '1']);
    const cmp = comparePositions(order);
    expect(
      cmp(positionOf(sorted[0]!, order), positionOf(sorted[1]!, order)),
    ).toBeLessThan(0);
  });
});

describe('title ordering', () => {
  const order = { field: 'title' as const, descending: false };
  const ids = (titles: string[]) =>
    sortRecipes(
      titles.map((t, i) => recipe(String(i), t)),
      order,
    ).map((r) => r.title);

  it('alphabetises accented titles with their base letter', () => {
    expect(ids(['Zucchini', 'Éclair', 'Eggs', 'Apple'])).toEqual([
      'Apple',
      'Éclair',
      'Eggs',
      'Zucchini',
    ]);
  });

  it('orders numbers by value', () => {
    expect(ids(['Soup 10', 'Soup 2'])).toEqual(['Soup 2', 'Soup 10']);
  });

  it('keeps cursor positions consistent with that order', () => {
    const cmp = comparePositions(order);
    expect(
      cmp({ key: 'Éclair', id: '1' }, { key: 'Eggs', id: '2' }),
    ).toBeLessThan(0);
  });
});
