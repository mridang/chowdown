import { describe, expect, it } from '@jest/globals';

import { CookFile } from '@/components/landing/cook-file-view';
import { RECIPES } from '@/components/landing/demo-recipes';
import { html } from '../render';

const recipe = RECIPES.find((r) => r.cooklang)!;

describe('CookFile', () => {
  it('is a window titled with the recipe file name', () => {
    const out = html(<CookFile recipe={recipe} />);
    expect(out).toContain('aria-label="A recipe as a plain text file"');
    expect(out).toMatch(/[a-z0-9-]+\.cook/);
  });

  it('highlights ingredients in the file', () => {
    expect(html(<CookFile recipe={recipe} />)).toContain('bg-marigold/40');
  });

  it('shows no more lines than asked for', () => {
    const lines = (n: number) =>
      html(<CookFile recipe={recipe} lines={n} />).match(
        /<span class="block">/g,
      )?.length;
    expect(lines(3)).toBe(3);
    expect(lines(5)).toBeGreaterThan(3);
  });
});
