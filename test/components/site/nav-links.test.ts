import { describe, expect, it } from '@jest/globals';

import {
  activeSection,
  APP_NAV,
  menuLinks,
  VISITOR_NAV,
} from '../../../src/components/site/nav-links';
import type { ShellUser } from '../../../src/lib/auth/shell-user';

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

  it('gives someone signed in the app links, starting with the header ones', () => {
    const labels = menuLinks(ADA).map(({ label }) => label);
    expect(labels).toEqual([
      'Recipes',
      'Favourites',
      'Add recipes',
      'Cook with AI',
    ]);
  });

  it('offers to connect Google Drive until that is done', () => {
    const links = menuLinks({ ...ADA, driveConnected: false });
    expect(links.at(-1)).toEqual({
      label: 'Connect Google Drive',
      href: '/api/auth/drive',
    });
    expect(menuLinks(ADA).map(({ label }) => label)).not.toContain(
      'Connect Google Drive',
    );
  });
});
