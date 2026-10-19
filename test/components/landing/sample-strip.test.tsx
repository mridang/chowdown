import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '../../../src/components/landing/demo-recipes';
import { SampleStrip } from '../../../src/components/landing/sample-strip';
import { html } from '../render';

describe('SampleStrip', () => {
  const recipes = RECIPES.slice(0, 6);
  const out = html(<SampleStrip recipes={recipes} />);

  it('says the recipes are examples', () => {
    expect(out).toContain('Example recipes');
  });

  it('lists every recipe as an item with its title', () => {
    expect(out.match(/<li/g)).toHaveLength(recipes.length);
    for (const recipe of recipes) expect(out).toContain(recipe.title);
  });

  it('staggers every second card', () => {
    expect(out.match(/lg:mt-8/g)).toHaveLength(3);
  });
});
