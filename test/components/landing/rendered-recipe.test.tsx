import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '../../../src/components/landing/demo-recipes';
import { RenderedRecipe } from '../../../src/components/landing/rendered-recipe';
import { html } from '../render';

describe('RenderedRecipe', () => {
  const recipe = RECIPES[0]!;
  const out = html(<RenderedRecipe recipe={recipe} />);

  it('is labelled with the recipe it shows', () => {
    expect(out).toContain(`aria-label="${recipe.title} in chowdown"`);
  });

  it('shows the title, the servings and a time', () => {
    expect(out).toContain(recipe.title);
    expect(out).toContain(`Serves ${recipe.servings}`);
    expect(out).toContain('min');
  });
});
