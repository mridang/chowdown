import { describe, expect, it } from '@jest/globals';

import {
  browseRecipes,
  filterOverview,
  pantryOf,
  recipesFromIngredients,
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
    expect(recipes.map((r) => r.name)).toEqual(['Pasta bake']);
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

  it('asks what they have when the list is empty', () => {
    const result = recipesFromIngredients(COLLECTION, { ingredients: [] });
    expect(result.isError).toBe(true);
  });

  it('says so when nothing fits', () => {
    const { message, recipes } = recipesFromIngredients(COLLECTION, {
      ingredients: ['dragon fruit'],
    });
    expect(recipes).toEqual([]);
    expect(message).toContain(
      'Nothing in the collection works with dragon fruit',
    );
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
