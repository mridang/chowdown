import { describe, expect, it } from '@jest/globals';

import {
  CARD_RESOURCE_URI,
  LIST_RESOURCE_URI,
} from '@/domain/mcp/ui-resources';
import { uncuratedFilename } from '@/lib/cooklang';
import {
  buildRecipeCardData,
  buildRecipeListData,
  errorResult,
  recipeCardResult,
  recipeListResult,
  recipeListSummaryResult,
  textResult,
} from '@/domain/mcp/tool-results';

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

describe('recipeCardResult, recipeListResult and recipeListSummaryResult', () => {
  it('point the host at the card template', () => {
    const result = recipeCardResult('id1', 'Soup.cook', SOURCE, 'Here');
    expect(result.content[0]?.text.startsWith('Here\n\n')).toBe(true);
    expect(result._meta).toEqual({
      'openai/outputTemplate': CARD_RESOURCE_URI,
    });
    expect(result.structuredContent).toMatchObject({ id: 'id1' });
  });

  it('put the recipe itself in the text a model reads', () => {
    const text =
      recipeCardResult('id1', 'Soup.cook', SOURCE, 'Here').content[0]?.text ??
      '';
    expect(text).toContain('Soup (id: id1)');
    expect(text).toContain('servings: 4');
    expect(text).toContain('- 1 l water');
    expect(text).toContain('1. Boil 1 l water.');
  });

  it('point the host at the list template and name the recipes in the text', () => {
    const result = recipeListResult([{ id: 'a', name: 'Soup.cook' }], 'Found');
    expect(result.content[0]?.text).toBe('Found\n\n- Soup (id: a)');
    expect(result._meta).toEqual({
      'openai/outputTemplate': LIST_RESOURCE_URI,
    });
    expect(result.structuredContent).toMatchObject({
      recipes: [{ id: 'a', title: 'Soup' }],
    });
  });

  it('leave the text at the message when the list is empty', () => {
    expect(recipeListResult([], 'No recipes yet.').content[0]?.text).toBe(
      'No recipes yet.',
    );
  });

  it('keep the text at the message for a message that already lists the recipes', () => {
    const result = recipeListSummaryResult(
      [{ id: 'a', name: 'Soup.cook' }],
      'You can make:\n- Soup',
    );
    expect(result.content[0]?.text).toBe('You can make:\n- Soup');
    expect(result.structuredContent).toMatchObject({
      recipes: [{ id: 'a', title: 'Soup' }],
    });
    expect(result._meta).toEqual({
      'openai/outputTemplate': LIST_RESOURCE_URI,
    });
  });
});
