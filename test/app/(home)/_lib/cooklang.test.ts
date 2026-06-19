import { describe, expect, it } from '@jest/globals';

import {
  formatQuantity,
  parseRecipe,
} from '../../../../src/app/(home)/_lib/cooklang';

describe('formatQuantity', () => {
  it('combines quantity and units', () => {
    expect(formatQuantity({ quantity: 200, units: 'g' })).toBe('200 g');
  });

  it('returns the quantity alone when there are no units', () => {
    expect(formatQuantity({ quantity: 2 })).toBe('2');
  });

  it('treats "some" and empty as no quantity', () => {
    expect(formatQuantity({ quantity: 'some' })).toBe('');
    expect(formatQuantity({ quantity: '', units: 'tsp' })).toBe('tsp');
  });
});

describe('parseRecipe', () => {
  const source = [
    '>> title: Test Bake',
    '>> servings: 2',
    '',
    'Mix @flour{200%g} and @eggs{2} in a #bowl{}.',
    'Bake for ~{20%minutes}.',
  ].join('\n');

  const recipe = parseRecipe(source, 'fallback.cook');

  it('uses the metadata title over the filename', () => {
    expect(recipe.title).toBe('Test Bake');
  });

  it('falls back to the filename (minus .cook) without a title', () => {
    expect(parseRecipe('Just add @water{}.', 'water.cook').title).toBe('water');
  });

  it('collects ingredients with formatted quantities', () => {
    expect(recipe.ingredients).toEqual([
      { name: 'flour', quantity: '200 g' },
      { name: 'eggs', quantity: '2' },
    ]);
  });

  it('collects cookware', () => {
    expect(recipe.cookware).toEqual(['bowl']);
  });

  it('exposes metadata without the title', () => {
    expect(recipe.metadata).toEqual([['servings', '2']]);
  });

  it('tokenises steps with ingredient, cookware and timer chips', () => {
    const kinds = recipe.steps.flat().map((token) => token.kind);
    expect(kinds).toContain('ingredient');
    expect(kinds).toContain('cookware');
    expect(kinds).toContain('timer');
  });
});
