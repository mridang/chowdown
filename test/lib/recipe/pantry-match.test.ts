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
