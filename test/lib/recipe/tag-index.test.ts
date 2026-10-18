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

  it('fills in the eating style for rows indexed before it existed', () => {
    const tags = rowTags(row(JSON.stringify({ cuisine: ['Indian'] })));
    expect(tags).toEqual({
      cuisine: ['Indian'],
      diet_type: ['Non-vegetarian'],
    });
  });

  it('handles a row that was never tagged', () => {
    expect(rowTags(row(null))['diet_type']).toEqual(['Non-vegetarian']);
  });

  it('keeps the stored eating style when there is one', () => {
    const stored = JSON.stringify({ diet_type: ['Vegan'] });
    expect(rowTags(row(stored))['diet_type']).toEqual(['Vegan']);
  });
});
