import { describe, expect, it } from '@jest/globals';

import RecipeNotFound, { metadata } from '@/app/(site)/recipe/[id]/not-found';
import { html } from '../../../../components/render';

const HREF_RECIPES_ADD = /href="\/recipes\/add"[^>]*>Add a recipe/;
const HREF_APP_BACK = /href="\/app"[^>]*>Back to your recipes/;
const H1_WE_COULDN = /<h1[^>]*>We couldn&#x27;t find that recipe<\/h1>/;

describe('RecipeNotFound', () => {
  const out = html(<RecipeNotFound />);

  it('has a title that says the recipe was not found', () => {
    expect(metadata.title).toBe('Recipe not found');
  });

  it('is a level-one heading saying so', () => {
    expect(out).toMatch(H1_WE_COULDN);
  });

  it('offers the way back to the list and the way to add a recipe', () => {
    expect(out).toMatch(HREF_APP_BACK);
    expect(out).toMatch(HREF_RECIPES_ADD);
  });
});
