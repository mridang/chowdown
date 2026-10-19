import { describe, expect, it } from '@jest/globals';

import RecipeNotFound, {
  metadata,
} from '../../../../../src/app/(site)/recipe/[id]/not-found';
import { html } from '../../../../components/render';

describe('RecipeNotFound', () => {
  const out = html(<RecipeNotFound />);

  it('has a title that says the recipe was not found', () => {
    expect(metadata.title).toBe('Recipe not found · chowdown');
  });

  it('is a level-one heading saying so', () => {
    expect(out).toMatch(/<h1[^>]*>We couldn&#x27;t find that recipe<\/h1>/);
  });

  it('offers the way back to the list and the way to add a recipe', () => {
    expect(out).toMatch(/href="\/app"[^>]*>Back to your recipes/);
    expect(out).toMatch(/href="\/recipes\/add"[^>]*>Add a recipe/);
  });
});
