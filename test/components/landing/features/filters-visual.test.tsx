import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '@/components/landing/demo-recipes';
import { FiltersVisual } from '@/components/landing/features/filters-visual';
import { html } from '../../render';

describe('FiltersVisual', () => {
  const out = html(<FiltersVisual recipes={RECIPES} />);

  it('shows the difficulty and time groups with their options', () => {
    for (const text of [
      'Difficulty',
      'Time',
      'Easy',
      'Medium',
      'Hard',
      'Up to 15 min',
      '16–30 min',
    ]) {
      expect(out).toContain(text);
    }
  });

  it('ticks exactly two options', () => {
    expect(out.match(/bg-ink text-white/g)).toHaveLength(2);
  });

  it('counts the easy recipes next to Easy', () => {
    const easy = RECIPES.filter((r) => r.difficulty === 'Easy').length;
    expect(out).toContain(`>${easy}</span>`);
  });
});
