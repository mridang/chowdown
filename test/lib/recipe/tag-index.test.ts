import { describe, expect, it } from '@jest/globals';

import { parseRecipe } from '../../../src/lib/recipe/cooklang';
import { extractFacetTags, rowTags } from '../../../src/lib/recipe/tag-index';

const SOURCE =
  '>> cuisine: Indian\n>> protein: Chicken\n\nCook @chicken thigh{500%g} with @onion{1}.\n';

describe('extractFacetTags', () => {
  it('works out the eating style from the ingredients', () => {
    const tags = extractFacetTags(parseRecipe(SOURCE, 'Curry.cook'));
    expect(tags['cuisine']).toEqual(['Indian']);
    expect(tags['diet_type']).toEqual(['Non-vegetarian']);
  });

  it('ignores an eating style written into the file', () => {
    const source = '>> diet_type: Vegan\n\nCook @chicken{500%g}.\n';
    expect(
      extractFacetTags(parseRecipe(source, 'Roast.cook'))['diet_type'],
    ).toEqual(['Non-vegetarian']);
  });

  it('leaves the eating style off a recipe with no ingredients to go on', () => {
    const tags = extractFacetTags(
      parseRecipe('>> cuisine: Indian\n', 'Upma [uncurated].cook'),
    );
    expect(tags['diet_type']).toBeUndefined();
  });

  it('uses the protein tag when an uncurated recipe has no ingredients', () => {
    const tags = extractFacetTags(
      parseRecipe('>> protein: pork\n', 'Pork Belly Stew.cook'),
    );
    expect(tags['diet_type']).toEqual(['Non-vegetarian']);
  });

  it('calls a recipe with only plants vegan', () => {
    const source = 'Slice @tomato{3} and add @basil{1%bunch}.\n';
    expect(
      extractFacetTags(parseRecipe(source, 'Salad.cook'))['diet_type'],
    ).toEqual(['Vegan']);
  });
});

describe('rowTags', () => {
  const row = (tags: string | null) => ({
    tags,
    source: SOURCE,
    name: 'Curry.cook',
  });

  it('reads tags from the recipe itself, eating style included', () => {
    expect(rowTags(row(null))).toEqual({
      cuisine: ['Indian'],
      protein: ['chicken'],
      diet_type: ['Non-vegetarian'],
    });
  });

  it('ignores whatever the cached column says, however stale or broken', () => {
    const fresh = rowTags(row(null));
    const stale = JSON.stringify({
      diet: ['Vegan', 'Vegetarian'],
      diet_type: ['Vegan'],
      bogus: ['x'],
    });
    expect(rowTags(row(stale))).toEqual(fresh);
    expect(rowTags(row('{not json'))).toEqual(fresh);
    expect(rowTags(row('[1,2]'))).toEqual(fresh);
  });

  it('leaves the eating style off a recipe with nothing to classify it by', () => {
    const bare = { source: '>> cuisine: Indian\n', name: 'A.cook' };
    expect(rowTags(bare)).toEqual({ cuisine: ['Indian'] });
  });

  it('reuses a recipe that is already parsed', () => {
    const parsed = parseRecipe(SOURCE, 'Curry.cook');
    expect(rowTags({ source: '', name: 'x.cook' }, parsed)).toEqual(
      rowTags(row(null)),
    );
  });
});
