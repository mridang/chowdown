import { describe, expect, it } from '@jest/globals';

import { Difficulty } from '@/components/ui/difficulty';
import { html } from '../render';

/** How many of the bars are drawn in the lit colour. */
const lit = (markup: string): number => markup.match(/bg-ember/g)?.length ?? 0;

describe('Difficulty', () => {
  it('lights one bar for Easy, two for Medium and three for Hard', () => {
    expect(lit(html(<Difficulty level="Easy" />))).toBe(1);
    expect(lit(html(<Difficulty level="Medium" />))).toBe(2);
    expect(lit(html(<Difficulty level="Hard" />))).toBe(3);
  });

  it('always draws three bars', () => {
    const out = html(<Difficulty level="Medium" />);
    expect(out.match(/rounded-\[1px\]/g)).toHaveLength(3);
  });

  it('describes the meter as an image with its level', () => {
    expect(html(<Difficulty level="Medium" />)).toContain(
      'role="img" aria-label="Medium difficulty, 2 of 3"',
    );
  });

  it('shows the level’s name unless asked not to', () => {
    expect(html(<Difficulty level="Easy" />)).toContain('<span>Easy</span>');
    expect(html(<Difficulty level="Easy" showLabel={false} />)).not.toContain(
      '<span>Easy</span>',
    );
  });

  it('treats a level it does not know as the easiest', () => {
    expect(lit(html(<Difficulty level="Impossible" />))).toBe(1);
  });
});
