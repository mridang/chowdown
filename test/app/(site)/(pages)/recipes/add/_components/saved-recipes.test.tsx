import { describe, expect, it } from '@jest/globals';

import { SavedRecipes } from '@/app/(site)/(pages)/recipes/add/_components/saved-recipes';
import { savedCard } from '@/domain/recipe/saved-card';
import { html } from '../../../../../../components/render';

const cards = ['one', 'two'].map((id) => {
  const card = savedCard({ id, title: `Recipe ${id}` });
  if (!card) {
    throw new Error('fixture is not a card');
  }
  return card;
});

describe('SavedRecipes', () => {
  const out = html(<SavedRecipes recipes={cards} />);

  it('shows a card for each saved recipe, linking to it', () => {
    expect(out).toContain('Recipe one');
    expect(out).toContain('Recipe two');
    expect(out).toContain('href="/recipe/one"');
    expect(out).toContain('href="/recipe/two"');
  });

  it('shows nothing when nothing was saved', () => {
    expect(html(<SavedRecipes recipes={[]} />)).toBe('');
  });
});
