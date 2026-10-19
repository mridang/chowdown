import { describe, expect, it } from '@jest/globals';

import { FavouritesLink } from '../../../src/components/recipes/favourites-link';
import { html } from '../render';

describe('FavouritesLink', () => {
  it('shows how many recipes are favourites', () => {
    const out = html(
      <FavouritesLink
        href="/app?favourites=1"
        active={false}
        serverIds={['a', 'b']}
      />,
    );
    expect(out).toContain('Favourites');
    expect(out).toContain('>2<');
  });

  it('is a link that marks itself current while on, and plain while off', () => {
    const on = html(<FavouritesLink href="/app" active serverIds={[]} />);
    const off = html(
      <FavouritesLink href="/app" active={false} serverIds={[]} />,
    );
    expect(on).toContain('aria-current="true"');
    expect(off).not.toContain('aria-current');
    expect(on).not.toContain('role="switch"');
  });
});
