import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '@/components/landing/demo-recipes';
import { SampleStrip } from '@/components/landing/sample-strip';
import { html } from '../render';

describe('SampleStrip', () => {
  const recipes = RECIPES.slice(0, 6);
  const out = html(<SampleStrip recipes={recipes} />);

  it('says the recipes are examples', () => {
    expect(out).toContain('Example recipes');
  });

  it.each(recipes)(
    'lists every recipe as an item with its title (%j)',
    (recipe) => {
      expect(out.match(/<li/gu)).toHaveLength(recipes.length);
      expect(out).toContain(recipe.title);
    },
  );

  it('staggers every second card', () => {
    expect(out.match(/lg:mt-8/gu)).toHaveLength(3);
  });
});
