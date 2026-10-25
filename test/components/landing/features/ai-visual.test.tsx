import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '@/components/landing/demo-recipes';
import { AiVisual } from '@/components/landing/features/ai-visual';
import { MCP_URL } from '@/utils/site';
import { html } from '../../render';

describe('AiVisual', () => {
  const out = html(<AiVisual recipes={RECIPES} />);

  it('shows the question and the connector address', () => {
    expect(out).toContain('What can I make with chicken');
    expect(out).toContain(MCP_URL);
  });

  it('suggests only quick chicken recipes', () => {
    const picks = RECIPES.filter(
      (r) => r.protein === 'chicken' && r.minutes <= 40,
    ).slice(0, 2);
    expect(picks.length).toBeGreaterThan(0);
    for (const recipe of picks) expect(out).toContain(recipe.title);
  });
});
