import { describe, expect, it } from '@jest/globals';

import {
  NO_DATA_MESSAGE,
  isRecipeCardData,
  isRecipeListData,
  readOutcome,
  textOf,
} from '../../src/views/payload';

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

describe('textOf', () => {
  it('joins the text blocks and skips everything else', () => {
    expect(
      textOf([
        { type: 'text', text: 'one' },
        { type: 'image', data: 'x' },
        { type: 'text', text: 'two' },
        null,
        { type: 'text', text: 3 },
      ]),
    ).toBe('one\n\ntwo');
  });

  it('is empty for no content', () => {
    expect(textOf(undefined)).toBe('');
    expect(textOf([])).toBe('');
  });
});

describe('readOutcome', () => {
  it('returns the data when the result carries it', () => {
    expect(
      readOutcome({ structuredContent: CARD, content: [] }, isRecipeCardData),
    ).toEqual({ kind: 'data', data: CARD });
  });

  it('turns an error result into its message, not a loading state', () => {
    expect(
      readOutcome(
        {
          isError: true,
          content: [{ type: 'text', text: 'No recipe found for "soup".' }],
        },
        isRecipeCardData,
      ),
    ).toEqual({
      kind: 'message',
      text: 'No recipe found for "soup".',
      isError: true,
    });
  });

  it('does not trust data in a result that is flagged as an error', () => {
    expect(
      readOutcome(
        { isError: true, structuredContent: CARD, content: [] },
        isRecipeCardData,
      ),
    ).toMatchObject({ kind: 'message', isError: true });
  });

  it('shows the text of a result without structured content, as a note', () => {
    expect(
      readOutcome(
        { content: [{ type: 'text', text: 'Nothing saved yet.' }] },
        isRecipeListData,
      ),
    ).toEqual({ kind: 'message', text: 'Nothing saved yet.', isError: false });
  });

  it('treats data of the wrong shape as a message too', () => {
    expect(
      readOutcome({ structuredContent: { recipes: 5 } }, isRecipeListData),
    ).toMatchObject({ kind: 'message', text: NO_DATA_MESSAGE });
  });
});
