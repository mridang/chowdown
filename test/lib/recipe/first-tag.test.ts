import { describe, expect, it } from '@jest/globals';

import { firstTag } from '@/lib/recipe/first-tag';

describe('firstTag', () => {
  it('is the first value of the key', () => {
    expect(firstTag({ cuisine: ['indian', 'thai'] }, 'cuisine')).toBe('indian');
  });

  it('is undefined for a key the recipe lacks, or one with no values', () => {
    expect(firstTag({}, 'cuisine')).toBeUndefined();
    expect(firstTag({ cuisine: [] }, 'cuisine')).toBeUndefined();
  });
});
