import { describe, expect, it } from '@jest/globals';

import { uncuratedFilename } from '../../../src/lib/recipe/cook-text';
import {
  buildRecipeCardData,
  buildRecipeListData,
  errorResult,
  recipeCardResult,
  recipeListResult,
  textResult,
} from '../../../src/lib/mcp/tool-results';

const SOURCE = [
  '>> servings: 4',
  '>> source: https://example.com/soup',
  '>> keywords: soup',
  '',
  'Boil @water{1%l}.',
].join('\n');

describe('textResult and errorResult', () => {
  it('wrap a sentence for the model to read', () => {
    expect(textResult('hi')).toEqual({
      content: [{ type: 'text', text: 'hi' }],
    });
  });

  it('mark the failure on an error', () => {
    expect(errorResult('no')).toEqual({
      content: [{ type: 'text', text: 'no' }],
      isError: true,
    });
  });
});

describe('buildRecipeCardData', () => {
  it('carries the id, the source link and only the useful metadata', () => {
    const card = buildRecipeCardData('id1', 'Soup.cook', SOURCE);
    expect(card.id).toBe('id1');
    expect(card.source).toBe('https://example.com/soup');
    expect(card.metadata.map(([key]) => key)).toEqual(['servings']);
    expect(card.uncurated).toBe(false);
    expect(card.logs).toEqual([]);
  });

  it('flags an idea stub as uncurated', () => {
    expect(
      buildRecipeCardData('id2', uncuratedFilename('idea'), SOURCE).uncurated,
    ).toBe(true);
  });

  it('shows quantities in the preferred measurement system', () => {
    const card = buildRecipeCardData('id1', 'Soup.cook', SOURCE, 'us');
    expect(JSON.stringify(card.ingredients)).not.toContain('"1 l"');
  });
});

describe('buildRecipeListData', () => {
  const files = [
    { id: 'a', name: 'Soup.cook' },
    { id: 'b', name: uncuratedFilename('idea') },
  ];

  it('lists each file under its display name', () => {
    expect(buildRecipeListData(files).recipes[0]?.title).toBe('Soup');
  });

  it('flags uncurated stubs', () => {
    expect(buildRecipeListData(files).recipes.map((r) => r.uncurated)).toEqual([
      false,
      true,
    ]);
  });

  it('carries the query only when there is one', () => {
    expect(buildRecipeListData(files)).not.toHaveProperty('query');
    expect(buildRecipeListData(files, '')).not.toHaveProperty('query');
    expect(buildRecipeListData(files, 'soup').query).toBe('soup');
  });
});

describe('recipeCardResult and recipeListResult', () => {
  it('point the host at the card template', () => {
    const result = recipeCardResult('id1', 'Soup.cook', SOURCE, 'Here');
    expect(result.content[0]?.text).toBe('Here');
    expect(result._meta).toEqual({
      'openai/outputTemplate': 'ui://recipe/card.html',
    });
    expect(result.structuredContent).toMatchObject({ id: 'id1' });
  });

  it('point the host at the list template', () => {
    const result = recipeListResult([{ id: 'a', name: 'Soup.cook' }], 'Found');
    expect(result._meta).toEqual({
      'openai/outputTemplate': 'ui://recipe/list.html',
    });
    expect(result.structuredContent).toMatchObject({
      recipes: [{ id: 'a', title: 'Soup' }],
    });
  });
});
