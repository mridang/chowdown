import { describe, expect, it } from '@jest/globals';

import { isRecipeCardData, isRecipeListData } from '@/views/guards';

/** A card payload the server would send. */
const CARD = {
  id: 'abc',
  title: 'Pasta',
  uncurated: false,
  metadata: [['servings', '4']],
  ingredients: [{ name: 'pasta', quantity: '200 g' }],
  cookware: ['pot'],
  steps: [[{ kind: 'text', text: 'Boil.' }]],
  logs: [],
};

const LIST = { recipes: [{ id: '1', title: 'Pasta', uncurated: false }] };

describe('isRecipeCardData', () => {
  it('accepts what the server sends', () => {
    expect(isRecipeCardData(CARD)).toBe(true);
  });

  it('refuses anything that is missing a part the card draws', () => {
    expect(isRecipeCardData({ ...CARD, steps: undefined })).toBe(false);
    expect(isRecipeCardData({ ...CARD, id: 7 })).toBe(false);
    expect(isRecipeCardData({ ...CARD, cookware: [1] })).toBe(false);
    expect(isRecipeCardData({ ...CARD, uncurated: 'no' })).toBe(false);
    expect(isRecipeCardData(null)).toBe(false);
    expect(isRecipeCardData('text')).toBe(false);
  });
});

describe('isRecipeListData', () => {
  it('accepts a list, empty or not, with or without a query', () => {
    expect(isRecipeListData(LIST)).toBe(true);
    expect(isRecipeListData({ recipes: [] })).toBe(true);
    expect(isRecipeListData({ ...LIST, query: 'soup' })).toBe(true);
  });

  it('refuses entries without an id and a title', () => {
    expect(isRecipeListData({ recipes: [{ id: '1' }] })).toBe(false);
    expect(isRecipeListData({ recipes: 'many' })).toBe(false);
    expect(isRecipeListData(undefined)).toBe(false);
  });
});
