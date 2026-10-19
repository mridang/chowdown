import { describe, expect, it } from '@jest/globals';

import { CardFact } from '../../../src/components/recipes/card-fact';
import { html } from '../render';

describe('CardFact', () => {
  it('puts the icon before the value on one line', () => {
    const out = html(<CardFact icon={<svg id="icon" />}>35 min</CardFact>);
    expect(out.indexOf('id="icon"')).toBeLessThan(out.indexOf('35 min'));
    expect(out).toContain('inline-flex');
  });

  it('is plain inline text, not a definition list entry', () => {
    const out = html(<CardFact icon={<svg />}>Easy</CardFact>);
    expect(out).not.toContain('<dt');
    expect(out).not.toContain('<dd');
  });
});
