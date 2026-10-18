import { describe, expect, it, jest } from '@jest/globals';

import type { Recipe } from '../../../src/lib/db/recipes';

import {
  browseRecipes,
  filterOverview,
  pantryOf,
  recipesFromIngredients,
  runScenarioTool,
  type ScenarioDeps,
  type ScenarioRecipe,
} from '../../../src/lib/mcp/scenarios';

const recipe = (
  name: string,
  tags: Record<string, string[]>,
  ingredients: [string, string][],
  extra: Partial<ScenarioRecipe> = {},
): ScenarioRecipe => ({
  id: name,
  name,
  filename: `${name}.cook`,
  tags,
  ingredients: ingredients.map(([n, quantity]) => ({ name: n, quantity })),
  favourite: false,
  ...extra,
});

const COLLECTION = [
  recipe(
    'Butter chicken',
    {
      cuisine: ['Indian'],
      diet_type: ['Non-vegetarian'],
      difficulty: ['Medium'],
    },
    [
      ['chicken', '500 g'],
      ['tomatoes', '4'],
      ['butter', '50 g'],
    ],
    { minutes: 45 },
  ),
  recipe(
    'Palak paneer',
    { cuisine: ['Indian'], diet_type: ['Vegetarian'] },
    [
      ['spinach', '400 g'],
      ['paneer', '200 g'],
    ],
    { minutes: 30, favourite: true },
  ),
  recipe('Chana masala', { cuisine: ['Indian'], diet_type: ['Vegan'] }, [
    ['chickpeas', '1 can'],
    ['tomatoes', '2'],
  ]),
  recipe('Mapo tofu', { cuisine: ['Chinese'], diet_type: ['Vegan'] }, [
    ['tofu', '300 g'],
  ]),
  recipe('Tomato pasta', { diet_type: ['Vegan'] }, [
    ['pasta', '400 g'],
    ['tomatoes', '3'],
    ['salt', '1 tsp'],
    ['olive oil', '2 tbsp'],
  ]),
  recipe('Pasta bake', { diet_type: ['Vegetarian'] }, [
    ['pasta', '300 g'],
    ['tomatoes', '3'],
    ['mozzarella', '125 g'],
    ['basil', '1 bunch'],
  ]),
  recipe('Carbonara', { diet_type: ['Non-vegetarian'] }, [
    ['spaghetti', '400 g'],
    ['guanciale', '150 g'],
    ['eggs', '4'],
    ['pecorino', '50 g'],
  ]),
];

describe('browseRecipes', () => {
  it('finds a cuisine and groups it from vegan to non-vegetarian', () => {
    const { message, recipes } = browseRecipes(COLLECTION, {
      cuisine: 'indian',
    });
    expect(recipes.map((r) => r.name)).toEqual([
      'Chana masala',
      'Palak paneer',
      'Butter chicken',
    ]);
    expect(message.indexOf('Vegan:')).toBeLessThan(
      message.indexOf('Vegetarian:'),
    );
    expect(message.indexOf('Vegetarian:')).toBeLessThan(
      message.indexOf('Non-vegetarian:'),
    );
    expect(message).toContain('3 recipes for Indian');
  });

  it('filters by eating style, time and favourites together', () => {
    const { recipes } = browseRecipes(COLLECTION, {
      diet_type: 'Vegetarian',
      max_minutes: 40,
      favourites_only: true,
    });
    expect(recipes.map((r) => r.name)).toEqual(['Palak paneer']);
  });

  it('says what is wrong when a value is not in the taxonomy', () => {
    const result = browseRecipes(COLLECTION, { diet_type: 'Carnivore' });
    expect(result.isError).toBe(true);
    expect(result.message).toContain('Vegan, Vegetarian, Pescatarian');
  });

  it('says how many recipes a time limit left out for not stating a time', () => {
    const { message } = browseRecipes(COLLECTION, {
      cuisine: 'Indian',
      max_minutes: 40,
    });
    expect(message).toContain(
      "(1 other recipe fits the rest but doesn't say how long it takes.)",
    );
  });

  it('suggests another route when nothing matches', () => {
    const { message, recipes } = browseRecipes(COLLECTION, {
      cuisine: 'Thai',
    });
    expect(recipes).toEqual([]);
    expect(message).toContain('No recipes for Thai');
    expect(message).toContain('list_filters');
  });

  it('limits the results and says how many there were', () => {
    const { recipes, message } = browseRecipes(COLLECTION, { limit: 2 });
    expect(recipes).toHaveLength(2);
    expect(message).toContain('showing 2 of 7');
  });
});

describe('pantryOf', () => {
  it('reads strings, lists in one string, and objects', () => {
    expect(
      pantryOf(['3 tomatoes and 400 g pasta', { name: 'garlic', quantity: 2 }]),
    ).toEqual([
      { name: 'tomatoes', quantity: '3' },
      { name: 'pasta', quantity: '400 g' },
      { name: 'garlic', quantity: '2' },
    ]);
  });

  it('ignores junk', () => {
    expect(pantryOf([1, null, { name: '' }, '  '])).toEqual([]);
  });
});

describe('recipesFromIngredients', () => {
  it('answers the 3 tomatoes and 400 g of pasta question', () => {
    const { message, recipes } = recipesFromIngredients(COLLECTION, {
      ingredients: ['3 tomatoes', '400 g pasta'],
    });
    expect(recipes[0]!.name).toBe('Tomato pasta');
    expect(message).toContain('You can make now (1)');
    expect(message).toContain('Almost there');
    expect(message).toContain('Pasta bake');
    expect(message).toContain('missing mozzarella and basil');
  });

  it('flags an ingredient they have too little of', () => {
    const { message } = recipesFromIngredients(COLLECTION, {
      ingredients: ['2 tomatoes', '400 g pasta'],
    });
    expect(message).toContain('need more tomatoes (have 2, need 3)');
  });

  it('can be limited to one eating style', () => {
    const { recipes } = recipesFromIngredients(COLLECTION, {
      ingredients: ['3 tomatoes', '400 g pasta'],
      diet_type: 'Vegetarian',
    });
    const names = recipes.map((r) => r.name);
    // vegetarian also takes vegan dishes, but never the meat one
    expect(names).toEqual(
      expect.arrayContaining(['Tomato pasta', 'Pasta bake']),
    );
    expect(names).not.toContain('Carbonara');
    expect(names).not.toContain('Butter chicken');
  });

  it('lists only what can be made now when no misses are allowed', () => {
    const { message } = recipesFromIngredients(COLLECTION, {
      ingredients: ['3 tomatoes', '400 g pasta'],
      allow_missing: 0,
    });
    expect(message).not.toContain('Almost there');
  });

  it('counts salt and oil as already in the kitchen unless told otherwise', () => {
    const assumed = recipesFromIngredients(COLLECTION, {
      ingredients: ['3 tomatoes', '400 g pasta'],
    });
    const strict = recipesFromIngredients(COLLECTION, {
      ingredients: ['3 tomatoes', '400 g pasta'],
      assume_staples: false,
    });
    expect(assumed.message).toContain('You can make now');
    expect(strict.message).not.toContain('You can make now');
  });

  it('shows the closest recipes, and what to buy, when none are in reach', () => {
    const { message, recipes } = recipesFromIngredients(COLLECTION, {
      ingredients: ['150 g guanciale'],
      allow_missing: 0,
    });
    expect(recipes.map((r) => r.name)).toEqual(['Carbonara']);
    expect(message).toContain(
      'Nothing can be made from 150 g guanciale as it stands',
    );
    expect(message).toContain('Carbonara');
    expect(message).toContain('missing spaghetti, eggs, and pecorino');
  });

  it('abbreviates a long shopping list', () => {
    const { message } = recipesFromIngredients(
      [
        recipe('Big stew', { diet_type: ['Vegan'] }, [
          ['lentils', '1 cup'],
          ['carrot', '2'],
          ['celery', '2'],
          ['leek', '1'],
          ['parsnip', '1'],
          ['thyme', '1 tsp'],
        ]),
      ],
      { ingredients: ['lentils'], allow_missing: 0 },
    );
    expect(message).toContain(
      'missing carrot, celery, leek, and parsnip and 1 more',
    );
  });

  it('asks what they have when the list is empty', () => {
    const result = recipesFromIngredients(COLLECTION, { ingredients: [] });
    expect(result.isError).toBe(true);
  });

  it('says so when nothing fits', () => {
    const { message, recipes } = recipesFromIngredients(COLLECTION, {
      ingredients: ['dragon fruit'],
    });
    expect(recipes).toEqual([]);
    expect(message).toContain('Nothing in the collection uses dragon fruit');
  });
});

describe('filterOverview', () => {
  it('counts each facet, eating styles in their usual order', () => {
    const { message } = filterOverview(COLLECTION);
    expect(message).toContain('7 recipes saved.');
    expect(message).toContain('Cuisine (cuisine): Indian 3, Chinese 1');
    expect(message).toContain(
      'Diet (diet_type): Vegan 3, Vegetarian 2, Non-vegetarian 2',
    );
  });

  it('copes with an empty collection', () => {
    expect(filterOverview([]).message).toBe('No recipes yet.');
  });
});

describe('browseRecipes — what the eating style and the other filters mean', () => {
  it('lets vegetarian take vegan dishes too, but never meat', () => {
    const names = browseRecipes(COLLECTION, {
      diet_type: 'Vegetarian',
    }).recipes.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['Chana masala', 'Palak paneer', 'Pasta bake']),
    );
    expect(names).not.toContain('Butter chicken');
  });

  it('lets pescatarian take vegan and vegetarian dishes, vegan only vegan', () => {
    const fish = recipe('Fish pie', { diet_type: ['Pescatarian'] }, [
      ['cod', '300 g'],
    ]);
    const all = [...COLLECTION, fish];
    const pesc = browseRecipes(all, { diet_type: 'Pescatarian' }).recipes.map(
      (r) => r.name,
    );
    expect(pesc).toEqual(
      expect.arrayContaining(['Fish pie', 'Pasta bake', 'Mapo tofu']),
    );
    expect(pesc).not.toContain('Carbonara');
    const vegan = browseRecipes(all, { diet_type: 'Vegan' }).recipes.map(
      (r) => r.name,
    );
    expect(vegan).not.toContain('Pasta bake');
  });

  it('only counts untimed recipes that fit everything else', () => {
    const { message } = browseRecipes(COLLECTION, {
      cuisine: 'Indian',
      max_minutes: 40,
      query: 'zzz',
    });
    expect(message).not.toContain("doesn't say");
    const fav = browseRecipes(COLLECTION, {
      cuisine: 'Indian',
      max_minutes: 40,
      favourites_only: true,
    });
    expect(fav.message).not.toContain("doesn't say");
  });

  it('matches every word of a query, in any order', () => {
    const names = browseRecipes(COLLECTION, {
      query: 'chicken butter',
    }).recipes.map((r) => r.name);
    expect(names).toEqual(['Butter chicken']);
  });

  it('accepts numbers given as strings', () => {
    const r = browseRecipes(COLLECTION, {
      cuisine: 'Indian',
      max_minutes: '40',
      limit: '1',
    });
    expect(r.recipes).toHaveLength(1);
    expect(r.message).toContain('at most 40 minutes');
  });

  it('describes the filters in plain words', () => {
    const { message } = browseRecipes(COLLECTION, {
      cuisine: 'Thai',
      max_minutes: 25,
      favourites_only: true,
    });
    expect(message).toContain(
      'No recipes for Thai (at most 25 minutes, favourites only)',
    );
  });
});

describe('recipesFromIngredients — long lists and how items are read', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      recipe(`Dish ${i}`, { diet_type: ['Vegan'] }, [
        ['tomatoes', '2'],
        [`thing ${i}`, '1'],
      ]),
    );

  it('says how many there really are when it cuts the list', () => {
    const { message, recipes } = recipesFromIngredients(many(30), {
      ingredients: ['tomatoes'],
      limit: 5,
    });
    expect(message).toContain('Almost there (showing 5 of 30)');
    expect(recipes).toHaveLength(5);
  });

  it('keeps an item that comes with an amount after the name together', () => {
    expect(pantryOf(['Tomatoes, 3'])).toEqual([
      { name: 'Tomatoes', quantity: '3' },
    ]);
    expect(pantryOf('tomatoes (chopped, canned), 2 onions')).toEqual([
      { name: 'tomatoes (chopped, canned)' },
      { name: 'onions', quantity: '2' },
    ]);
  });

  it('does not split amounts or names that contain a comma or an "and"', () => {
    expect(pantryOf(['1,5 kg potatoes'])).toEqual([
      { name: 'potatoes', quantity: '1,5 kg' },
    ]);
    expect(pantryOf(['1,000 g flour'])).toEqual([
      { name: 'flour', quantity: '1,000 g' },
    ]);
    expect(pantryOf(['mac and cheese'])).toEqual([{ name: 'mac and cheese' }]);
    expect(pantryOf(['half and half, 2 eggs'])).toEqual([
      { name: 'half and half' },
      { name: 'eggs', quantity: '2' },
    ]);
  });

  it('ignores a bare number as an item', () => {
    expect(pantryOf(['3'])).toEqual([]);
  });

  it('caps how much it will read, so a huge request cannot hog the server', () => {
    const items = pantryOf(Array.from({ length: 5000 }, (_, i) => `item ${i}`));
    expect(items).toHaveLength(60);
    const long = pantryOf(['x'.repeat(100_000)]);
    expect(long[0]!.name.length).toBeLessThanOrEqual(80);
    const started = Date.now();
    recipesFromIngredients(many(300), {
      ingredients: Array.from({ length: 5000 }, (_, i) => `item ${i}`),
    });
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe('filterOverview — recipes with no eating style', () => {
  it('counts them so the totals add up', () => {
    const { message } = filterOverview([
      ...COLLECTION,
      recipe('Mystery', {}, []),
    ]);
    expect(message).toContain(
      'Vegan 3, Vegetarian 2, Non-vegetarian 2, Unclassified 1',
    );
  });
});

describe('runScenarioTool', () => {
  const row = (id: string, name: string, source: string): Recipe =>
    ({ drive_file_id: id, name, source, tags: null }) as Recipe;
  const CURRY = row(
    '1',
    'Curry.cook',
    '>> cuisine: Indian\n\nCook @chicken{500%g}.\n',
  );
  const SALAD = row(
    '2',
    'Salad.cook',
    '>> cuisine: Greek\n\nSlice @tomato{3}.\n',
  );

  const deps = (rows: Recipe[], overrides: Partial<ScenarioDeps> = {}) => {
    const sync = jest.fn(async () => 0);
    const inBackground = jest.fn();
    const all: ScenarioDeps = {
      rows: async () => rows,
      favouriteIds: async () => ['2'],
      sync,
      inBackground,
      ...overrides,
    };
    return { all, sync, inBackground };
  };

  it('answers from the cache and refreshes it afterwards', async () => {
    const { all, sync, inBackground } = deps([CURRY, SALAD]);
    const result = await runScenarioTool(
      'browse_recipes',
      { cuisine: 'Indian' },
      all,
    );
    expect(result.recipes.map((r) => r.name)).toEqual(['Curry']);
    expect(result.plain).toBe(false);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(inBackground).toHaveBeenCalledTimes(1);
  });

  it('fills an empty cache from Drive first, and waits for it', async () => {
    let cached: Recipe[] = [];
    const sync = jest.fn(async () => {
      cached = [CURRY];
    });
    const { all } = deps([], { rows: async () => cached, sync });
    const result = await runScenarioTool('browse_recipes', {}, all);
    expect(result.recipes.map((r) => r.name)).toEqual(['Curry']);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('answers with an empty collection when Drive cannot be reached', async () => {
    const { all } = deps([], {
      sync: async () => {
        throw new Error('Drive is down');
      },
    });
    const result = await runScenarioTool('list_filters', {}, all);
    expect(result.message).toBe('No recipes yet.');
    expect(result.plain).toBe(true);
  });

  it('knows which recipes are favourites and works the eating style out for old rows', async () => {
    const { all } = deps([CURRY, SALAD]);
    const fav = await runScenarioTool(
      'browse_recipes',
      { favourites_only: true },
      all,
    );
    expect(fav.recipes.map((r) => r.name)).toEqual(['Salad']);
    const vegan = await runScenarioTool(
      'browse_recipes',
      { diet_type: 'Vegan' },
      all,
    );
    expect(vegan.recipes.map((r) => r.name)).toEqual(['Salad']);
  });

  it('passes a bad argument back as an error', async () => {
    const { all } = deps([CURRY]);
    const result = await runScenarioTool(
      'browse_recipes',
      { cuisine: 'Martian' },
      all,
    );
    expect(result.isError).toBe(true);
  });

  it('finds recipes from ingredients', async () => {
    const { all } = deps([CURRY, SALAD]);
    const result = await runScenarioTool(
      'recipes_from_ingredients',
      { ingredients: ['3 tomatoes'] },
      all,
    );
    expect(result.recipes.map((r) => r.name)).toEqual(['Salad']);
    expect(result.message).toContain('You can make now (1)');
  });
});

describe('a capped list stays representative', () => {
  const many = ['Vegan', 'Vegetarian', 'Pescatarian', 'Non-vegetarian'].flatMap(
    (diet) =>
      Array.from({ length: 6 }, (_, i) =>
        recipe(
          `${diet} dish ${i}`,
          { cuisine: ['Indian'], diet_type: [diet] },
          [['x', '1']],
        ),
      ),
  );

  it('takes from each eating style rather than letting the first fill it', () => {
    const { recipes, message } = browseRecipes(many, {
      cuisine: 'Indian',
      limit: 8,
    });
    const diets = recipes.map((r) => r.tags['diet_type']![0]);
    for (const diet of [
      'Vegan',
      'Vegetarian',
      'Pescatarian',
      'Non-vegetarian',
    ]) {
      expect(diets.filter((d) => d === diet)).toHaveLength(2);
    }
    expect(message).toContain('showing 8 of 24');
  });
});

describe('the closest recipes when none are in reach', () => {
  it('put the ones that use most of what you have first, not the shortest recipes', () => {
    const { recipes } = recipesFromIngredients(
      [
        recipe('Tiny', { diet_type: ['Vegan'] }, [
          ['pork belly', '1'],
          ['a', '1'],
          ['b', '1'],
        ]),
        recipe('Big', { diet_type: ['Non-vegetarian'] }, [
          ['pork belly', '1'],
          ['kimchi', '1'],
          ['rice', '1'],
          ['c', '1'],
          ['d', '1'],
          ['e', '1'],
          ['f', '1'],
        ]),
      ],
      { ingredients: ['pork belly', 'kimchi', 'rice'], allow_missing: 0 },
    );
    expect(recipes.map((r) => r.name)).toEqual(['Big', 'Tiny']);
  });

  it('shorten the long, messy ingredient names scraped from the web', () => {
    const { message } = recipesFromIngredients(
      [
        recipe('Messy', { diet_type: ['Vegan'] }, [
          ['rice', '1'],
          [
            'low-moisture mozzarella (not fresh mozzarella), chilled and cut into slices',
            '1',
          ],
        ]),
      ],
      { ingredients: ['rice'], allow_missing: 0 },
    );
    expect(message).toContain('missing low-moisture mozzarella (not fresh');
    expect(message).toContain('…');
    expect(message).not.toContain('chilled');
  });
});
