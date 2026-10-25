import { describe, expect, it } from '@jest/globals';

import { ifNoneMatchHit } from '@/lib/core/api';
import {
  ifMatchSatisfiedForRecipe,
  representationTag,
} from '@/domain/recipe/etag';

describe('representationTag', () => {
  it('keeps the base tag for JSON and gives each other representation its own', () => {
    expect(representationTag('"abc"', 'json')).toBe('"abc"');
    expect(representationTag('"abc"', 'cooklang')).toBe('"abc-cooklang"');
    expect(representationTag('"abc"', 'ld')).toBe('"abc-ld"');
  });

  it('is never mistaken for another representation by If-None-Match', () => {
    const json = representationTag('"abc"', 'json');
    const cook = representationTag('"abc"', 'cooklang');
    expect(ifNoneMatchHit(json, cook)).toBe(false);
    expect(ifNoneMatchHit(cook, cook)).toBe(true);
  });
});

describe('ifMatchSatisfiedForRecipe', () => {
  it('allows a write when there is no If-Match', () => {
    expect(ifMatchSatisfiedForRecipe(null, '"abc"')).toBe(true);
  });

  it('lets any representation tag stand for the base content tag', () => {
    expect(ifMatchSatisfiedForRecipe('"abc"', '"abc"')).toBe(true);
    expect(ifMatchSatisfiedForRecipe('"abc-cooklang"', '"abc"')).toBe(true);
    expect(ifMatchSatisfiedForRecipe('"abc-ld"', '"abc"')).toBe(true);
    expect(ifMatchSatisfiedForRecipe('W/"abc-cooklang"', '"abc"')).toBe(true);
    expect(ifMatchSatisfiedForRecipe('*', '"abc"')).toBe(true);
  });

  it('refuses a stale tag in any representation', () => {
    expect(ifMatchSatisfiedForRecipe('"old"', '"abc"')).toBe(false);
    expect(ifMatchSatisfiedForRecipe('"old-ld"', '"abc"')).toBe(false);
  });
});
