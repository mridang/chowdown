import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_VIEW,
  LIST_VIEWS,
  parseListView,
  VIEW_COOKIE,
  viewCookie,
} from '@/components/recipes/list-view';

describe('parseListView', () => {
  it.each(LIST_VIEWS)('reads %s as itself', (view) => {
    expect(parseListView(view)).toBe(view);
  });

  it.each([undefined, '', 'carousel', 'LIST', ' list'])(
    'falls back to the grid for %p',
    (value) => {
      expect(DEFAULT_VIEW).toBe('grid');
      expect(parseListView(value)).toBe('grid');
    },
  );
});

describe('viewCookie', () => {
  it('names the layout, for a year, on the listing only', () => {
    const cookie = viewCookie('list', false);
    expect(cookie).toContain(`${VIEW_COOKIE}=list`);
    expect(cookie).toContain('Path=/app');
    expect(cookie).toContain(`Max-Age=${365 * 24 * 60 * 60}`);
    expect(cookie).toContain('SameSite=Lax');
  });

  it('is marked Secure only on https', () => {
    expect(viewCookie('grid', true)).toContain('; Secure');
    expect(viewCookie('grid', false)).not.toContain('Secure');
  });

  it('round-trips through the reader', () => {
    const value = viewCookie('list', false).split(';')[0]?.split('=')[1];
    expect(parseListView(value)).toBe('list');
  });
});
