import { describe, expect, it } from '@jest/globals';

import { EmptyCollection } from '../../../src/components/recipes/empty-collection';
import { html } from '../render';

describe('EmptyCollection', () => {
  it('says there are no recipes and links to adding some', () => {
    const out = html(<EmptyCollection />);
    expect(out).toMatch(/<h2[^>]*>No recipes yet<\/h2>/);
    expect(out).toContain('href="/recipes/add"');
    expect(out).toContain('Add recipes');
  });
});
