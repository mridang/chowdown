import { describe, expect, it } from '@jest/globals';

import { activeSection } from '../../../src/components/site/header-nav';

describe('activeSection', () => {
  it('marks the recipe list, and a recipe opened from it, as Recipes', () => {
    expect(activeSection('/app', false)).toBe('search');
    expect(activeSection('/recipe/abc', false)).toBe('search');
  });

  it('marks the favourites view as Favourites', () => {
    expect(activeSection('/app', true)).toBe('favourites');
  });

  it('does not let ?fav=1 on a recipe page pick Favourites', () => {
    expect(activeSection('/recipe/abc', true)).toBe('search');
  });

  it('does not mistake the add-recipes page (/recipes/add) for a recipe', () => {
    expect(activeSection('/recipes/add', false)).toBeUndefined();
  });

  it('knows the connect page, and leaves other pages unmarked', () => {
    expect(activeSection('/connect', false)).toBe('connect');
    expect(activeSection('/privacy', false)).toBeUndefined();
    expect(activeSection('/', false)).toBeUndefined();
  });
});
