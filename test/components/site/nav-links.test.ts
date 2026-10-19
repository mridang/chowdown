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

  it('gives someone signed in the app links, starting with the header ones, then Drive', () => {
    const labels = menuLinks(ADA).map(({ label }) => label);
    expect(labels).toEqual([
      'Recipes',
      'Favourites',
      'Add recipes',
      'Cook with AI',
      'Open Drive',
    ]);
  });

  it('gives each signed-in link a picture, and the visitor links none', () => {
    expect(menuLinks(ADA).map(({ icon }) => icon)).toEqual([
      'recipes',
      'favourites',
      'add',
      'ai',
      'drive',
    ]);
    expect(VISITOR_NAV.every((link) => !('icon' in link))).toBe(true);
  });

  it('offers to connect Google Drive until that is done', () => {
    expect(menuLinks({ ...ADA, driveConnected: false }).at(-1)).toEqual({
      label: 'Connect Google Drive',
      href: '/api/auth/drive',
      external: false,
      icon: 'drive',
    });
  });

  it('opens Drive in a new tab once it is connected, at the Recipes folder if known', () => {
    expect(menuLinks(ADA).at(-1)).toEqual({
      label: 'Open Drive',
      href: 'https://drive.google.com/drive/my-drive',
      external: true,
      icon: 'drive',
    });
    expect(
      menuLinks({ ...ADA, recipesFolderId: 'folder-1' }).at(-1)?.href,
    ).toBe('https://drive.google.com/drive/folders/folder-1');
  });

  it('never links to a folder id that is not a Drive id', () => {
    expect(menuLinks({ ...ADA, recipesFolderId: '../evil' }).at(-1)?.href).toBe(
      'https://drive.google.com/drive/my-drive',
    );
  });
});
