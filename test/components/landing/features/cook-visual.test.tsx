import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '@/components/landing/demo-recipes';
import { CookVisual } from '@/components/landing/features/cook-visual';
import { html } from '../../render';

describe('CookVisual', () => {
  const recipe = RECIPES[0]!;
  const out = html(<CookVisual recipe={recipe} />);

  it('is one labelled image of a phone in cook mode', () => {
    expect(out).toContain('role="img"');
    expect(out).toContain('Cook mode on a phone');
  });

  it('shows the recipe title, the step number and the step', () => {
    expect(out).toContain(recipe.title);
    expect(out).toContain('>3</span>');
    expect(out).toContain('Cover and simmer for 25 minutes');
  });
});
