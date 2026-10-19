import { describe, expect, it } from '@jest/globals';

import {
  heroCrumbs,
  heroEyebrow,
} from '../../../../../../src/app/(site)/recipe/[id]/_components/recipe-hero';

describe('heroCrumbs', () => {
  it('starts at the list of recipes', () => {
    expect(heroCrumbs(undefined)).toEqual([{ label: 'Recipes', href: '/app' }]);
  });

  it('adds the cuisine, linking to that cuisine in the list', () => {
    expect(heroCrumbs('south indian')).toEqual([
      { label: 'Recipes', href: '/app' },
      { label: 'South indian', href: '/app?cuisine=south%20indian' },
    ]);
  });
});

describe('heroEyebrow', () => {
  it('joins the cuisine and the course', () => {
    expect(heroEyebrow('indian', 'dinner')).toBe('Indian · Dinner');
  });

  it('shows whichever of the two the recipe has', () => {
    expect(heroEyebrow('indian', undefined)).toBe('Indian');
    expect(heroEyebrow(undefined, 'dinner')).toBe('Dinner');
  });

  it('is undefined when the recipe has neither', () => {
    expect(heroEyebrow(undefined, undefined)).toBeUndefined();
    expect(heroEyebrow('', '')).toBeUndefined();
  });
});
