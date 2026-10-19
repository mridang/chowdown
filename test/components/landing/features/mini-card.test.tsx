import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '../../../../src/components/landing/demo-recipes';
import { MiniCard } from '../../../../src/components/landing/features/mini-card';
import { html } from '../../render';

describe('MiniCard', () => {
  it('shows the title, the time and the difficulty', () => {
    const recipe = RECIPES[0]!;
    const out = html(<MiniCard recipe={recipe} />);
    expect(out).toContain(recipe.title);
    expect(out).toContain(recipe.difficulty);
    expect(out).toContain('aria-hidden="true"');
  });
});
