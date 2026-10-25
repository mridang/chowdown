import { describe, expect, it } from '@jest/globals';

import { HERO_RECIPE, RECIPES } from '@/components/landing/demo-recipes';

describe('RECIPES', () => {
  it('lists the featured recipe first', () => {
    expect(RECIPES[0]).toBe(HERO_RECIPE);
  });

  it('has eight recipes with different ids', () => {
    expect(RECIPES).toHaveLength(8);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(8);
  });

  it('gives every recipe the facts a card shows, and no photo', () => {
    for (const recipe of RECIPES) {
      expect(recipe.minutes).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(['Easy', 'Medium', 'Hard']).toContain(recipe.difficulty);
      expect(recipe.cover).toBeUndefined();
    }
  });
});

describe('HERO_RECIPE', () => {
  it('alone carries the Cooklang source the landing page shows', () => {
    expect(HERO_RECIPE.cooklang).toContain('>> title: Smoky Chipotle');
    expect(RECIPES.filter((recipe) => recipe.cooklang)).toEqual([HERO_RECIPE]);
  });

  it('has a source whose numbers match the recipe’s own facts', () => {
    expect(HERO_RECIPE.cooklang).toContain(
      `>> servings: ${HERO_RECIPE.servings}`,
    );
    expect(HERO_RECIPE.cooklang).toContain(
      `>> time: ${HERO_RECIPE.minutes}%minutes`,
    );
  });
});
