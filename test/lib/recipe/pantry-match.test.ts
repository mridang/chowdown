import { describe, expect, it } from '@jest/globals';

import {
  ingredientWords,
  isStaple,
  matchRecipe,
  parsePantryItem,
  rankMatches,
  sameIngredient,
} from '../../../src/lib/recipe/pantry-match';

const needs = (...pairs: [string, string][]) =>
  pairs.map(([quantity, name]) => ({ quantity, name }));

describe('parsePantryItem', () => {
  it('reads an amount with a unit', () => {
    expect(parsePantryItem('400 g pasta')).toEqual({
      name: 'pasta',
      quantity: '400 g',
    });
    expect(parsePantryItem('1 can of chickpeas')).toEqual({
      name: 'chickpeas',
      quantity: '1 can',
    });
    expect(parsePantryItem('2 cups rice')).toEqual({
      name: 'rice',
      quantity: '2 cups',
    });
  });

  it('reads a bare count as the amount', () => {
    expect(parsePantryItem('3 tomatoes')).toEqual({
      name: 'tomatoes',
      quantity: '3',
    });
    expect(parsePantryItem('2 red onions')).toEqual({
      name: 'red onions',
      quantity: '2',
    });
  });

  it('takes a plain name as is', () => {
    expect(parsePantryItem('  garlic ')).toEqual({ name: 'garlic' });
  });
});

describe('ingredientWords', () => {
  it('drops descriptors, singularises and folds synonyms', () => {
    expect(ingredientWords('3 finely chopped Tomatoes')).toEqual(['tomato']);
    expect(ingredientWords('aubergines')).toEqual(['eggplant']);
    expect(ingredientWords('Spaghetti')).toEqual(['pasta']);
    expect(ingredientWords('crème fraîche (full fat)')).toEqual([
      'creme',
      'fraiche',
    ]);
  });
});

describe('sameIngredient', () => {
  it('matches plurals, shapes and regional names', () => {
    expect(sameIngredient('tomatoes', 'tomato')).toBe(true);
    expect(sameIngredient('pasta', 'spaghetti')).toBe(true);
    expect(sameIngredient('courgette', 'zucchini')).toBe(true);
    expect(sameIngredient('chicken', 'chicken breast')).toBe(true);
  });

  it('does not treat a processed form as the raw thing, either way round', () => {
    expect(sameIngredient('tomato', 'tomato paste')).toBe(false);
    expect(sameIngredient('tomato sauce', 'tomato')).toBe(false);
    expect(sameIngredient('pasta', 'pasta sauce')).toBe(false);
    expect(sameIngredient('olive', 'olive oil')).toBe(false);
  });

  it('does not match unrelated things', () => {
    expect(sameIngredient('onion', 'garlic')).toBe(false);
    expect(sameIngredient('', 'garlic')).toBe(false);
  });
});

describe('isStaple', () => {
  it('assumes salt, pepper, water and oil', () => {
    for (const name of [
      'salt',
      'black pepper',
      'water',
      'olive oil',
      'vegetable oil',
    ]) {
      expect(isStaple(name)).toBe(true);
    }
    expect(isStaple('garlic powder')).toBe(false);
    expect(isStaple('butter')).toBe(false);
  });
});

describe('matchRecipe', () => {
  const pantry = [
    parsePantryItem('3 tomatoes'),
    parsePantryItem('400 g pasta'),
  ];

  it('covers a recipe made of what you have plus the staples', () => {
    const match = matchRecipe(
      needs(
        ['300 g', 'spaghetti'],
        ['2', 'tomatoes'],
        ['', 'salt'],
        ['2 tbsp', 'olive oil'],
      ),
      pantry,
    );
    expect(match.missing).toEqual([]);
    expect(match.short).toEqual([]);
    expect(match.used).toBe(2);
  });

  it('lists what is missing', () => {
    const match = matchRecipe(
      needs(['300 g', 'pasta'], ['3 cloves', 'garlic'], ['1 bunch', 'basil']),
      pantry,
    );
    expect(match.missing).toEqual(['garlic', 'basil']);
  });

  it('notices when you have too little', () => {
    const match = matchRecipe(
      needs(['500 g', 'pasta'], ['2', 'tomatoes']),
      pantry,
    );
    expect(match.short).toEqual([
      { name: 'pasta', have: '400 g', need: '500 g' },
    ]);
  });

  it('compares across units, and ignores amounts it cannot compare', () => {
    expect(matchRecipe(needs(['14 oz', 'pasta']), pantry).short).toEqual([]);
    expect(matchRecipe(needs(['1 lb', 'pasta']), pantry).short).toEqual([
      { name: 'pasta', have: '400 g', need: '1 lb' },
    ]);
    expect(matchRecipe(needs(['2 cups', 'pasta']), pantry).short).toEqual([]);
    expect(matchRecipe(needs(['4', 'tomatoes']), pantry).short).toEqual([
      { name: 'tomatoes', have: '3', need: '4' },
    ]);
  });

  it('can stop assuming staples', () => {
    const match = matchRecipe(needs(['', 'salt']), pantry, {
      assumeStaples: false,
    });
    expect(match.missing).toEqual(['salt']);
  });
});

describe('rankMatches', () => {
  const make = (id: string, missing: string[], used: number, short = 0) => ({
    recipe: id,
    match: {
      covered: [],
      missing,
      short: Array.from({ length: short }, () => ({
        name: 'x',
        have: '1',
        need: '2',
      })),
      used,
    },
  });

  it('separates cookable from nearly, best first', () => {
    const { canMake, almost } = rankMatches(
      [
        make('one-item', [], 1),
        make('two-items', [], 2),
        make('missing-1', ['a'], 2),
        make('missing-2', ['a', 'b'], 2),
        make('missing-3', ['a', 'b', 'c'], 2),
        make('short', [], 2, 1),
        make('unrelated', [], 0),
      ],
      2,
    );
    expect(canMake.map((m) => m.recipe)).toEqual(['two-items', 'one-item']);
    expect(almost.map((m) => m.recipe)).toEqual([
      'missing-1',
      'short',
      'missing-2',
    ]);
  });
});

describe('parsePantryItem — how people write amounts', () => {
  it.each([
    ['1 lb. chicken', 'chicken', '1 lb'],
    ['3x tomato', 'tomato', '3'],
    ['200 gr rice', 'rice', '200 gr'],
    ['3 pcs chicken', 'chicken', '3 pcs'],
    ['1 stick butter', 'butter', '1 stick'],
    ['1 loaf bread', 'bread', '1 loaf'],
    ['1 head garlic', 'garlic', '1 head'],
    ['a dozen eggs', 'eggs', '12'],
    ['half a dozen eggs', 'eggs', '6'],
    ['half a kilo of mince', 'mince', '0.5 kilo'],
    ['two eggs', 'eggs', '2'],
    ['one onion', 'onion', '1'],
    ['1½ lbs tomatillos', 'tomatillos', '1½ lbs'],
    ['1,5 kg potatoes', 'potatoes', '1,5 kg'],
    ['1,000 g flour', 'flour', '1,000 g'],
    ['2 x 400g tins of tomatoes', 'tomatoes', '800 g'],
    ['400g pasta', 'pasta', '400 g'],
    ['tomatoes (3)', 'tomatoes', '3'],
    ['Tomatoes, 3', 'Tomatoes', '3'],
    ['500ml milk', 'milk', '500 ml'],
  ])('%s', (text, name, quantity) => {
    expect(parsePantryItem(text)).toEqual({ name, quantity });
  });

  it('gives a plain name no amount, and a bare number no name', () => {
    expect(parsePantryItem('garlic')).toEqual({ name: 'garlic' });
    expect(parsePantryItem('3').name).toBe('');
  });
});

describe('sameIngredient — what counts as the same thing', () => {
  it.each([
    ['milk', 'coconut milk'],
    ['milk', 'almond milk'],
    ['milk', 'milk chocolate'],
    ['butter', 'peanut butter'],
    ['butter', 'butter beans'],
    ['potato', 'sweet potato'],
    ['rice', 'rice paper'],
    ['rice', 'rice wine'],
    ['rice', 'cauliflower rice'],
    ['corn', 'corn tortillas'],
    ['tortilla', 'tortilla chips'],
    ['cream', 'cream of tartar'],
    ['cream', 'cream cheese'],
    ['banana', 'banana leaves'],
    ['mustard', 'mustard greens'],
    ['tomato', 'sun-dried tomatoes'],
    ['tomato', 'tomato paste'],
    ['cilantro', 'ground coriander'],
    ['coriander seeds', 'cilantro'],
    ['onions', 'spring onions'],
    ['scallions', 'onions'],
    ['mince', 'ground cumin'],
    ['mince', 'ground cinnamon'],
    ['rice', 'rice noodles'],
  ])('%s is not %s, either way round', (a, b) => {
    expect(sameIngredient(a, b)).toBe(false);
    expect(sameIngredient(b, a)).toBe(false);
  });

  it.each([
    ['cheddar', 'cheddar cheese'],
    ['parmesan', 'parmesan cheese'],
    ['vanilla', 'vanilla extract'],
    ['ramen', 'ramen noodles'],
    ['soy sauce', 'soya sauce'],
    ['tortillas', 'flour tortillas'],
    ['flour tortillas', 'tortillas'],
    ['clove', 'cloves'],
    ['garlic clove', 'garlic cloves'],
    ['olive', 'olives'],
    ['radish', 'radishes'],
    ['chili', 'chilies'],
    ['chillies', 'chile'],
    ['cilantro', 'coriander'],
    ['scallions', 'green onions'],
    ['500 g beef mince', 'ground beef'],
    ['beef', 'ground beef'],
  ])('%s is %s', (a, b) => {
    expect(sameIngredient(a, b)).toBe(true);
    expect(sameIngredient(b, a)).toBe(true);
  });
});

describe('isStaple — by the whole name', () => {
  it.each([
    'salt',
    'Kosher salt',
    'black pepper',
    'freshly ground black pepper',
    'salt and pepper',
    'salt, to taste',
    'water',
    'cold water',
    'olive oil',
    'extra-virgin olive oil',
    'vegetable oil',
    'ice',
  ])('%s is', (name) => {
    expect(isStaple(name)).toBe(true);
  });

  it.each([
    'red bell pepper',
    'jalapeno peppers',
    'cayenne pepper',
    'pepper jack',
    'pepper flakes',
    'salt pork',
    'salt cod',
    'water chestnuts',
    'coconut water',
    'rose water',
    'sesame oil',
    'tuna in oil',
    'garlic powder',
    'chicken',
  ])('%s is not', (name) => {
    expect(isStaple(name)).toBe(false);
  });
});

describe('matchRecipe — amounts', () => {
  const need = (name: string, quantity: string) => ({ name, quantity });

  it('does not call it short when the units count different things', () => {
    const m = matchRecipe(
      [need('garlic', '4 cloves')],
      [{ name: 'garlic', quantity: '1 head' }],
    );
    expect(m.short).toEqual([]);
    const eggs = matchRecipe(
      [need('eggs', '6')],
      [{ name: 'eggs', quantity: '1 dozen' }],
    );
    expect(eggs.short).toEqual([]);
  });

  it('flags too few of the same counted thing', () => {
    const m = matchRecipe(
      [need('cloves', '3 cloves')],
      [{ name: 'cloves', quantity: '1 clove' }],
    );
    expect(m.short).toHaveLength(1);
  });

  it('adds up several items of the same thing', () => {
    const m = matchRecipe(
      [need('eggs', '6')],
      [
        { name: 'eggs', quantity: '3' },
        { name: 'eggs', quantity: '4' },
      ],
    );
    expect(m.short).toEqual([]);
    expect(m.used).toBe(2);
  });

  it('adds up a recipe that lists the same ingredient twice', () => {
    const m = matchRecipe(
      [need('tomatoes', '2'), need('tomatoes', '3')],
      [{ name: 'tomatoes', quantity: '3' }],
    );
    expect(m.short).toEqual([{ name: 'tomatoes', have: '3', need: '5' }]);
  });

  it('prefers the item whose name is closest, and counts them all as used', () => {
    const m = matchRecipe(
      [need('coconut milk', '400 ml')],
      [
        { name: 'milk', quantity: '1 cup' },
        { name: 'coconut milk', quantity: '400 ml' },
      ],
    );
    expect(m.short).toEqual([]);
    expect(m.covered).toEqual(['coconut milk']);
    expect(m.used).toBe(1);
  });

  it('does not let a thousands separator turn a kilo into a gram', () => {
    const m = matchRecipe(
      [need('flour', '500 g')],
      [{ name: 'flour', quantity: '1,000 g' }],
    );
    expect(m.short).toEqual([]);
  });

  it('does not call a recipe makeable on the strength of its peppers or oils', () => {
    const m = matchRecipe(
      [
        need('red bell pepper', '2'),
        need('salt pork', '100 g'),
        need('rice', '1 cup'),
      ],
      [{ name: 'rice' }],
    );
    expect(m.missing).toEqual(['red bell pepper', 'salt pork']);
  });
});
