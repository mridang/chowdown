import { describe, expect, it } from '@jest/globals';

import { FavouriteButton } from '../../../src/components/recipes/favourite-button';
import { html } from '../render';

describe('FavouriteButton, overlay', () => {
  it('is a button that says it is off and what pressing it does', () => {
    const out = html(
      <FavouriteButton recipeId="dal" initial={false} variant="overlay" />,
    );
    expect(out).toContain('type="button"');
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain('aria-label="Add to favourites"');
    expect(out).toContain('title="Add to favourites"');
  });

  it('says it is on, and offers to remove, for a favourite', () => {
    const out = html(
      <FavouriteButton recipeId="dal" initial variant="overlay" />,
    );
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('aria-label="Remove from favourites"');
    expect(out).toContain('title="Remove from favourites"');
  });

  it('has only an icon, so no visible text', () => {
    const out = html(
      <FavouriteButton recipeId="dal" initial={false} variant="overlay" />,
    );
    expect(out.replace(/<[^>]*>/g, '')).toBe('');
  });

  it('takes its position from the caller', () => {
    expect(
      html(
        <FavouriteButton
          recipeId="dal"
          initial={false}
          variant="overlay"
          className="absolute top-3 right-3"
        />,
      ),
    ).toContain('absolute top-3 right-3');
  });
});

describe('FavouriteButton, labelled', () => {
  it('is the default, named by its visible text', () => {
    const out = html(<FavouriteButton recipeId="dal" initial={false} />);
    expect(out).toContain('>Favourite</button>');
    expect(out).toContain('aria-pressed="false"');
    expect(out).not.toContain('aria-label');
    expect(out).toContain('title="Add to favourites"');
  });

  it('reads "Favourited" for a favourite', () => {
    const out = html(
      <FavouriteButton recipeId="dal" initial variant="labelled" />,
    );
    expect(out).toContain('>Favourited</button>');
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('title="Remove from favourites"');
  });
});
