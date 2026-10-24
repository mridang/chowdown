import { describe, expect, it } from '@jest/globals';

import { FavouriteBadge } from '@/components/recipes/favourite-badge';
import { html } from '../render';

describe('FavouriteBadge', () => {
  it('is decoration: hidden from assistive technology and not a control', () => {
    const out = html(<FavouriteBadge on={false} />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain('<button');
    expect(out).not.toContain('tabindex');
    expect(out).not.toContain('aria-pressed');
  });

  it('draws a heart, filled when the recipe is a favourite', () => {
    const filled = html(<FavouriteBadge on />);
    const outline = html(<FavouriteBadge on={false} />);
    expect(filled).toContain('<svg');
    expect(filled).not.toBe(outline);
  });

  it('takes its position from the caller', () => {
    expect(html(<FavouriteBadge on className="absolute top-3" />)).toContain(
      'absolute top-3',
    );
  });
});
