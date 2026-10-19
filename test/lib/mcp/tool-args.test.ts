import { describe, expect, it } from '@jest/globals';

import {
  canonicalArguments,
  limitArg,
  numberArg,
  offsetArg,
  stringArg,
  stringListArg,
} from '../../../src/lib/mcp/tool-args';

describe('stringArg', () => {
  it('trims a string and gives empty for anything else', () => {
    expect(stringArg('  hi ')).toBe('hi');
    expect(stringArg(undefined)).toBe('');
    expect(stringArg(5)).toBe('');
    expect(stringArg(null)).toBe('');
  });
});

describe('stringListArg', () => {
  it('takes one value or a list, splitting commas and dropping blanks', () => {
    expect(stringListArg('a, b')).toEqual(['a', 'b']);
    expect(stringListArg(['a', ' ', 'b,c'])).toEqual(['a', 'b', 'c']);
    expect(stringListArg(undefined)).toEqual([]);
  });

  it('counts numbers as strings and ignores other kinds of value', () => {
    expect(stringListArg([5, true, null, {}, 'x'])).toEqual(['5', 'x']);
  });
});

describe('numberArg', () => {
  it('accepts numbers and numeric strings only', () => {
    expect(numberArg(5)).toBe(5);
    expect(numberArg(' 7 ')).toBe(7);
    expect(numberArg('')).toBeUndefined();
    expect(numberArg('abc')).toBeUndefined();
    expect(numberArg(Infinity)).toBeUndefined();
    expect(numberArg(null)).toBeUndefined();
  });
});

describe('limitArg', () => {
  it('defaults to 12 and keeps the limit between 1 and 50', () => {
    expect(limitArg(undefined)).toBe(12);
    expect(limitArg(0)).toBe(1);
    expect(limitArg(-4)).toBe(1);
    expect(limitArg(500)).toBe(50);
    expect(limitArg('7')).toBe(7);
  });

  it('rounds down to a whole number', () => {
    expect(limitArg(2.9)).toBe(2);
  });
});

describe('offsetArg', () => {
  it('defaults to the start and never goes below it', () => {
    expect(offsetArg(undefined)).toBe(0);
    expect(offsetArg(-5)).toBe(0);
    expect(offsetArg('abc')).toBe(0);
    expect(offsetArg(null)).toBe(0);
  });

  it('rounds down to a whole number', () => {
    expect(offsetArg(12)).toBe(12);
    expect(offsetArg('24')).toBe(24);
    expect(offsetArg(2.9)).toBe(2);
  });
});

describe('canonicalArguments', () => {
  it.each([
    ['get_recipe', { name: 'pie' }, { recipe: 'pie' }],
    ['find_similar', { name: 'pie' }, { recipe: 'pie' }],
    [
      'browse_recipes',
      { diet: 'Gluten-free' },
      { dietary_needs: 'Gluten-free' },
    ],
  ])(
    'renames the older spelling of an argument of %s',
    (tool, args, expected) => {
      expect(canonicalArguments(tool, args)).toEqual(expected);
    },
  );

  it('keeps every other argument as it is', () => {
    expect(
      canonicalArguments('browse_recipes', {
        diet: 'x',
        limit: 3,
        cuisine: 'y',
      }),
    ).toEqual({ dietary_needs: 'x', limit: 3, cuisine: 'y' });
  });

  it('leaves both spellings alone when both are given, so the check can refuse the older one', () => {
    expect(
      canonicalArguments('get_recipe', { name: 'a', recipe: 'b' }),
    ).toEqual({ name: 'a', recipe: 'b' });
  });

  it('does not rename an argument of a tool that never had the older spelling', () => {
    expect(canonicalArguments('add_recipe', { name: 'Soup' })).toEqual({
      name: 'Soup',
    });
    expect(canonicalArguments('constructor', { name: 'x' })).toEqual({
      name: 'x',
    });
  });

  it('turns the pantry given as one piece of text into a list of one', () => {
    expect(
      canonicalArguments('recipes_from_ingredients', {
        ingredients: '3 tomatoes and 400 g pasta',
      }),
    ).toEqual({ ingredients: ['3 tomatoes and 400 g pasta'] });
  });

  it('leaves a list, and any other value, for the check to judge', () => {
    expect(
      canonicalArguments('recipes_from_ingredients', { ingredients: ['a'] }),
    ).toEqual({ ingredients: ['a'] });
    expect(
      canonicalArguments('recipes_from_ingredients', { ingredients: 5 }),
    ).toEqual({ ingredients: 5 });
    expect(canonicalArguments('browse_recipes', { limit: '5' })).toEqual({
      limit: '5',
    });
  });

  it('carries a key called __proto__ as an ordinary property', () => {
    const args = JSON.parse('{"__proto__": 1, "name": "x"}') as Record<
      string,
      unknown
    >;
    const result = canonicalArguments('get_recipe', args);
    expect(Object.keys(result).toSorted()).toEqual(['__proto__', 'recipe']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
