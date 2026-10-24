import { describe, expect, it } from '@jest/globals';

import {
  activeSection,
  APP_NAV,
  menuLinks,
  VISITOR_NAV,
} from '@/components/site/nav-links';
import type { ShellUser } from '@/lib/auth/shell-user';

const ADA: ShellUser = {
  firstName: 'Ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  driveConnected: true,
};

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

describe('APP_NAV', () => {
  it('has one link for each section the header can mark', () => {
    expect(APP_NAV.map(({ key }) => key)).toEqual(['search', 'favourites']);
  });
});

describe('menuLinks', () => {
  it('gives a visitor the landing page sections', () => {
    expect(menuLinks(null)).toBe(VISITOR_NAV);
    expect(menuLinks(null).map(({ href }) => href)).toEqual([
      '/#features',
      '/#faq',
    ]);
  });

  it('gives someone signed in the app links, and leaves Drive and the assistant to the account menu', () => {
    expect(menuLinks(ADA).map(({ label }) => label)).toEqual([
      'Recipes',
      'Favourites',
      'Add recipes',
    ]);
  });

  it('gives each signed-in link a picture, and the visitor links none', () => {
    expect(menuLinks(ADA).map(({ icon }) => icon)).toEqual([
      'recipes',
      'favourites',
      'add',
    ]);
    expect(VISITOR_NAV.every((link) => !('icon' in link))).toBe(true);
  });

  it('offers the same links whether or not Drive is connected', () => {
    expect(menuLinks({ ...ADA, driveConnected: false })).toEqual(
      menuLinks(ADA),
    );
  });
});
