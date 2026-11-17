import { describe, expect, it } from '@jest/globals';

import { EmptyCollection } from '@/components/recipes/empty-collection';
import { html } from '../render';

const H2_NO_RECIPES = /<h2[^>]*>No recipes yet<\/h2>/u;

describe('EmptyCollection', () => {
  it('says there are no recipes and links to adding some', () => {
    const out = html(<EmptyCollection />);
    expect(out).toMatch(H2_NO_RECIPES);
    expect(out).toContain('href="/recipes/add"');
    expect(out).toContain('Add recipes');
  });
});
