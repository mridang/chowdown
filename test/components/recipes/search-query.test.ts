import { describe, expect, it } from '@jest/globals';

import {
  activeFilters,
  buildFacets,
  hrefFor,
  matches,
  moreHref,
  PAGE_SIZE,
  parseQuery,
  sortRecipes,
  timeBucket,
  toggled,
  valuesOf,
} from '@/components/recipes/search-query';
import type { CardRecipe } from '@/domain/recipe/card-data';

/** A recipe with every fact; tests override what they care about. */
function recipe(over: Partial<CardRecipe> & { id: string }): CardRecipe {
  return {
    title: over.id,
    site: '',
    minutes: 20,
    servings: 2,
    difficulty: 'Easy',
    cuisine: 'Indian',
    protein: 'chicken',
    category: 'Dinner',
    diet: [],
    dietType: 'Non-vegetarian',
    method: [],
    keywords: [],
    favourite: false,
    tone: 'sand',
    ...over,
  };
}

/** A saved page that says nothing about time, difficulty, protein or cuisine. */
const BARE: CardRecipe = recipe({
  id: 'bare',
  title: 'Bare',
  minutes: undefined,
  servings: undefined,
  difficulty: undefined,
  cuisine: '',
  protein: '',
  category: '',
  dietType: undefined,
});

const query = (params: Record<string, string> = {}) => parseQuery(params);

describe('parseQuery', () => {
  it('reads the search text, favourites switch, sort and filters', () => {
    expect(
      parseQuery({
        q: '  curry ',
        fav: '1',
        sort: 'time',
        protein: 'chicken, beef',
        diet_type: 'Vegan',
        site: ['a.com', 'b.com'],
      }),
    ).toEqual({
      q: 'curry',
      favourites: true,
      sort: 'time',
      limit: PAGE_SIZE,
      selected: {
        protein: ['chicken', 'beef'],
        diet_type: ['Vegan'],
        site: ['a.com'],
      },
    });
  });

  it('leaves out a filter with nothing chosen, blanks and stray commas included', () => {
    expect(parseQuery({ protein: ' , ,', cuisine: '' }).selected).toEqual({});
  });

  it('takes the first of a repeated parameter', () => {
    expect(parseQuery({ q: ['rice', 'pasta'] }).q).toBe('rice');
  });

  it('falls back to defaults for unknown sorts and bad limits', () => {
    expect(parseQuery({ sort: 'random', limit: '3' })).toMatchObject({
      sort: 'title',
      limit: PAGE_SIZE,
    });
    expect(parseQuery({ limit: '48' }).limit).toBe(48);
  });
});

describe('timeBucket', () => {
  it('puts minutes into the buckets the Time filter offers', () => {
    expect([15, 16, 30, 31, 60, 61].map(timeBucket)).toEqual([
      '15',
      '30',
      '30',
      '60',
      '60',
      'long',
    ]);
  });
});

describe('valuesOf', () => {
  it('gives nothing for a fact the recipe lacks', () => {
    for (const key of [
      'difficulty',
      'time',
      'protein',
      'cuisine',
      'category',
      'diet_type',
      'diet',
      'method',
      'site',
    ] as const) {
      expect(valuesOf(BARE, key)).toEqual([]);
    }
  });

  it('gives the eating style from diet_type and the needs from diet', () => {
    const r = recipe({ id: 'r', dietType: 'Vegan', diet: ['Gluten-free'] });
    expect(valuesOf(r, 'diet_type')).toEqual(['Vegan']);
    expect(valuesOf(r, 'diet')).toEqual(['Gluten-free']);
  });

  it('buckets a time', () => {
    expect(valuesOf(recipe({ id: 'r', minutes: 45 }), 'time')).toEqual(['60']);
  });
});

describe('matches', () => {
  it('finds text in the title, site, cuisine, protein and keywords', () => {
    const r = recipe({
      id: 'r',
      title: 'Crème brûlée',
      site: 'seriouseats.com',
      keywords: ['custard'],
    });
    for (const q of ['creme', 'SERIOUS', 'indian', 'chicken', 'custard']) {
      expect(matches(r, query({ q }))).toBe(true);
    }
    expect(matches(r, query({ q: 'tofu' }))).toBe(false);
  });

  it('needs every word, in any order', () => {
    const r = recipe({ id: 'r', title: 'Curry with rice' });
    expect(matches(r, query({ q: 'rice curry' }))).toBe(true);
    expect(matches(r, query({ q: 'rice pudding' }))).toBe(false);
  });

  it('ignores case in filter values', () => {
    expect(matches(recipe({ id: 'r' }), query({ protein: 'Chicken' }))).toBe(
      true,
    );
  });

  it('filters by eating style', () => {
    const vegan = recipe({ id: 'v', dietType: 'Vegan' });
    expect(matches(vegan, query({ diet_type: 'Vegan,Vegetarian' }))).toBe(true);
    expect(matches(recipe({ id: 'n' }), query({ diet_type: 'Vegan' }))).toBe(
      false,
    );
  });

  it('never matches a recipe without a time against a time filter', () => {
    expect(matches(BARE, query({ time: '15,30' }))).toBe(false);
    expect(matches(BARE, query())).toBe(true);
  });

  it('keeps only favourites when asked', () => {
    expect(matches(recipe({ id: 'r' }), query({ fav: '1' }))).toBe(false);
    expect(
      matches(recipe({ id: 'r', favourite: true }), query({ fav: '1' })),
    ).toBe(true);
  });
});

describe('sortRecipes', () => {
  const slow = recipe({ id: 'slow', title: 'B slow', minutes: 90 });
  const quick = recipe({ id: 'quick', title: 'C quick', minutes: 10 });
  const hard = recipe({ id: 'hard', title: 'A hard', difficulty: 'Hard' });

  it('orders by title the way a person would, ignoring accents', () => {
    const titles = sortRecipes(
      [
        recipe({ id: '1', title: 'Zucchini' }),
        recipe({ id: '2', title: 'Éclair' }),
        recipe({ id: '3', title: 'apple' }),
      ],
      'title',
    ).map((r) => r.title);
    expect(titles).toEqual(['apple', 'Éclair', 'Zucchini']);
  });

  it('puts the quickest first and recipes with no time last', () => {
    expect(sortRecipes([BARE, slow, quick], 'time').map((r) => r.id)).toEqual([
      'quick',
      'slow',
      'bare',
    ]);
  });

  it('puts the easiest first, then the quickest, with unrated last', () => {
    expect(
      sortRecipes([BARE, hard, slow, quick], 'easy').map((r) => r.id),
    ).toEqual(['quick', 'slow', 'hard', 'bare']);
  });

  it('does not change the list it is given', () => {
    const list = [quick, slow];
    sortRecipes(list, 'time');
    expect(list[0]).toBe(quick);
  });
});

describe('hrefFor and friends', () => {
  it('leaves out anything at its default', () => {
    expect(hrefFor(query())).toBe('/app');
  });

  it('writes the whole query as a link', () => {
    const q = query({ q: 'rice', fav: '1', sort: 'easy', cuisine: 'Thai' });
    expect(hrefFor(q)).toBe('/app?q=rice&fav=1&sort=easy&cuisine=Thai');
  });

  it('round-trips a query through its link', () => {
    const q = query({ protein: 'beef,lamb', diet_type: 'Pescatarian' });
    const params = Object.fromEntries(
      new URL(hrefFor(q), 'http://x').searchParams,
    );
    expect(parseQuery(params)).toEqual(q);
  });

  it('toggles a value on and off', () => {
    const on = toggled(query(), 'protein', 'beef');
    expect(hrefFor(on)).toBe('/app?protein=beef');
    expect(hrefFor(toggled(on, 'protein', 'beef'))).toBe('/app');
  });

  it('asks for one more page of the same results', () => {
    expect(moreHref(query())).toBe(`/app?limit=${PAGE_SIZE * 2}`);
    expect(moreHref(query({ q: 'rice', limit: '48' }))).toBe(
      '/app?q=rice&limit=72',
    );
  });
});

describe('activeFilters', () => {
  it('labels each switched-on filter with the link that removes it', () => {
    const chips = activeFilters(
      query({ fav: '1', time: '15', diet_type: 'Vegan', site: 'a.com' }),
    );
    expect(chips.map((c) => c.label)).toEqual([
      'Favourites',
      'Up to 15 min',
      'Vegan',
      'a.com',
    ]);
    expect(chips[2]!.href).toBe('/app?fav=1&time=15&site=a.com');
  });
});

describe('buildFacets', () => {
  const recipes = [
    recipe({ id: '1', dietType: 'Non-vegetarian', site: 'a.com' }),
    recipe({ id: '2', dietType: 'Vegan', site: 'a.com', minutes: 100 }),
    recipe({ id: '3', dietType: 'Vegetarian', site: 'b.com' }),
    BARE,
  ];
  const facet = (key: string, q = query()) =>
    buildFacets(recipes, q).find((f) => f.key === key);

  it('lists eating styles in their natural order under "Diet"', () => {
    const diet = facet('diet_type')!;
    expect(diet.title).toBe('Diet');
    expect(diet.options.map((o) => o.value)).toEqual([
      'Vegan',
      'Vegetarian',
      'Non-vegetarian',
    ]);
  });

  it('calls the dietary-needs filter "Dietary needs" and drops it when empty', () => {
    expect(facet('diet')).toBeUndefined();
    const withNeeds = buildFacets(
      [recipe({ id: 'g', diet: ['Gluten-free'] })],
      query(),
    ).find((f) => f.key === 'diet');
    expect(withNeeds!.title).toBe('Dietary needs');
  });

  it('counts only recipes that have a time', () => {
    const time = facet('time')!;
    expect(time.options.map((o) => [o.value, o.count])).toEqual([
      ['30', 2],
      ['long', 1],
    ]);
  });

  it('does not offer empty values for missing facts', () => {
    expect(facet('cuisine')!.options.reduce((n, o) => n + o.count, 0)).toBe(3);
    expect(facet('cuisine')!.options.some((o) => o.value === '')).toBe(false);
  });

  it('offers a site only when it has at least two recipes, or is selected', () => {
    expect(facet('site')!.options.map((o) => o.value)).toEqual(['a.com']);
    expect(
      facet('site', query({ site: 'b.com' }))!.options.map((o) => o.value),
    ).toEqual(['a.com', 'b.com']);
  });

  it('lists difficulty from easiest to hardest, whatever the counts', () => {
    const levels = buildFacets(
      [
        recipe({ id: 'h1', difficulty: 'Hard' }),
        recipe({ id: 'h2', difficulty: 'Hard' }),
        recipe({ id: 'e', difficulty: 'Easy' }),
        recipe({ id: 'm', difficulty: 'Medium' }),
      ],
      query(),
    ).find((f) => f.key === 'difficulty');
    expect(levels!.options.map((o) => o.value)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
  });

  it('lists the other filters by popularity, then alphabetically', () => {
    const cuisines = buildFacets(
      [
        recipe({ id: '1', cuisine: 'Thai' }),
        recipe({ id: '2', cuisine: 'Indian' }),
        recipe({ id: '3', cuisine: 'Indian' }),
        recipe({ id: '4', cuisine: 'Greek' }),
      ],
      query(),
    ).find((f) => f.key === 'cuisine');
    expect(cuisines!.options.map((o) => o.value)).toEqual([
      'Indian',
      'Greek',
      'Thai',
    ]);
  });

  it('labels a time bucket by its range', () => {
    expect(facet('time')!.options.map((o) => o.label)).toEqual([
      '16–30 min',
      'Over an hour',
    ]);
  });

  it('marks active options and links to toggle them', () => {
    const option = facet('diet_type', query({ diet_type: 'Vegan' }))!
      .options[0]!;
    expect(option).toMatchObject({ active: true, href: '/app' });
  });
});
