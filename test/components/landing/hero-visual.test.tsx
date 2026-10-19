import { describe, expect, it } from '@jest/globals';

import { HeroVisual } from '../../../src/components/landing/hero-visual';
import { RECIPES } from '../../../src/components/landing/demo-recipes';
import { html } from '../render';

describe('HeroVisual', () => {
  it('shows the text file and the rendered recipe side by side', () => {
    const out = html(<HeroVisual recipe={RECIPES[0]!} />);
    expect(out).toContain('A recipe as a plain text file');
    expect(out).toContain(`${RECIPES[0]!.title} in chowdown`);
  });
});
