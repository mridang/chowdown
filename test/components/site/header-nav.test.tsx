import { describe, expect, it } from '@jest/globals';

import { HeaderNav } from '@/components/site/header-nav';
import { htmlAt } from '../render';

const ARIA_CURRENT_PAGE = /aria-current="page"[^>]*>Recipes</u;
const ARIA_CURRENT_PAGE_2 = /aria-current="page"[^>]*>Favourites</u;
const HREF_APP_FAV = /<a [^>]*href="\/app\?fav=1"[^>]*>Favourites<\/a>/u;
const HREF_APP_RECIPES = /<a [^>]*href="\/app"[^>]*>Recipes<\/a>/u;

describe('HeaderNav', () => {
  it('is the main navigation, with a link for Recipes and one for Favourites', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/privacy' });
    expect(out).toContain('aria-label="Main"');
    expect(out).toMatch(HREF_APP_RECIPES);
    expect(out).toMatch(HREF_APP_FAV);
  });

  it('marks neither as the current page on a page outside both', () => {
    expect(htmlAt(<HeaderNav />, { pathname: '/privacy' })).not.toContain(
      'aria-current',
    );
  });

  it('marks Recipes as the current page on the list', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/app' });
    expect(out).toMatch(ARIA_CURRENT_PAGE);
    expect(out.match(/aria-current/gu)).toHaveLength(1);
  });

  it('marks Favourites on the list when only favourites are shown', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/app', search: '?fav=1' });
    expect(out).toMatch(ARIA_CURRENT_PAGE_2);
  });

  it('keeps a recipe opened from the list under Recipes', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/recipe/abc' });
    expect(out).toMatch(ARIA_CURRENT_PAGE);
  });
});
