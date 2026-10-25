import { describe, expect, it } from '@jest/globals';

import {
  hasFavouriteTag,
  withFavouriteTag,
} from '@/domain/recipe/favourite-tag';

const SRC =
  '>> title: Pasta\n>> servings: 2\n\nBoil @pasta{200%g}.\n-- [cook 2026-01-01] great\n';

describe('withFavouriteTag', () => {
  it('adds the marker to the metadata block and leaves the rest alone', () => {
    const out = withFavouriteTag(SRC, true);
    expect(out).toContain('>> favourite: true');
    expect(out).toContain('Boil @pasta{200%g}.');
    expect(out).toContain('-- [cook 2026-01-01] great');
    expect(out.indexOf('>> favourite')).toBeLessThan(out.indexOf('Boil'));
  });

  it('is idempotent when turned on twice', () => {
    const once = withFavouriteTag(SRC, true);
    expect(withFavouriteTag(once, true)).toBe(once);
    expect(once.match(/favourite/g)).toHaveLength(1);
  });

  it('removes the marker when turned off', () => {
    const out = withFavouriteTag(withFavouriteTag(SRC, true), false);
    expect(out).not.toContain('favourite');
    expect(out).toContain('>> title: Pasta');
  });

  it('turning off a recipe that was never a favourite changes nothing', () => {
    expect(withFavouriteTag(SRC, false)).toBe(SRC);
  });
});

describe('hasFavouriteTag', () => {
  it('reads the marker', () => {
    expect(hasFavouriteTag(withFavouriteTag(SRC, true))).toBe(true);
    expect(hasFavouriteTag(SRC)).toBe(false);
  });

  it('accepts yes/1 and ignores false', () => {
    expect(hasFavouriteTag('>> favourite: yes\n')).toBe(true);
    expect(hasFavouriteTag('>> favourite: 1\n')).toBe(true);
    expect(hasFavouriteTag('>> favourite: false\n')).toBe(false);
  });
});
