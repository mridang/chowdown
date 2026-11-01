import { describe, expect, it } from '@jest/globals';

import { ViewToggle } from '@/components/recipes/view-toggle';
import { htmlAt } from '../render';

/** The radio button for a layout, as markup. */
const radio = (markup: string, value: string) =>
  new RegExp(`<input[^>]*value="${value}"[^>]*>`).exec(markup)?.[0] ?? '';

describe('ViewToggle', () => {
  it('is a labelled group offering the grid and the list', () => {
    const out = htmlAt(<ViewToggle value="grid" />);
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain('aria-label="Layout"');
    expect(out).toContain('>Grid</span>');
    expect(out).toContain('>List</span>');
  });

  it.each([
    ['grid', 'list'],
    ['list', 'grid'],
  ] as const)('has %s chosen and %s not', (chosen, other) => {
    const out = htmlAt(<ViewToggle value={chosen} />);
    expect(radio(out, chosen)).toContain('checked=""');
    expect(radio(out, other)).not.toContain('checked');
  });
});
