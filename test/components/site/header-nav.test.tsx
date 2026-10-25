import { describe, expect, it } from '@jest/globals';

import { HeaderNav } from '@/components/site/header-nav';
import { htmlAt } from '../render';

describe('HeaderNav', () => {
  it('is the main navigation, with a link for Recipes and one for Favourites', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/privacy' });
    expect(out).toContain('aria-label="Main"');
    expect(out).toMatch(/<a [^>]*href="\/app"[^>]*>Recipes<\/a>/);
    expect(out).toMatch(/<a [^>]*href="\/app\?fav=1"[^>]*>Favourites<\/a>/);
  });

  it('marks neither as the current page on a page outside both', () => {
    expect(htmlAt(<HeaderNav />, { pathname: '/privacy' })).not.toContain(
      'aria-current',
    );
  });

  it('marks Recipes as the current page on the list', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/app' });
    expect(out).toMatch(/aria-current="page"[^>]*>Recipes</);
    expect(out.match(/aria-current/g)).toHaveLength(1);
  });

  it('marks Favourites on the list when only favourites are shown', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/app', search: '?fav=1' });
    expect(out).toMatch(/aria-current="page"[^>]*>Favourites</);
  });

  it('keeps a recipe opened from the list under Recipes', () => {
    const out = htmlAt(<HeaderNav />, { pathname: '/recipe/abc' });
    expect(out).toMatch(/aria-current="page"[^>]*>Recipes</);
  });
});
