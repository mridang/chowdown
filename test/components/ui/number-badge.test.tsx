import { describe, expect, it } from '@jest/globals';

import { NumberBadge } from '@/components/ui/number-badge';
import { classOf, html } from '../render';

describe('NumberBadge', () => {
  it('shows the number, hidden from assistive technology', () => {
    const out = html(<NumberBadge value={3} />);
    expect(out).toContain('>3<');
    expect(out).toContain('aria-hidden="true"');
  });

  it('comes in three sizes and two tones', () => {
    expect(
      classOf(html(<NumberBadge value={1} size="lg" />), 'span'),
    ).toContain('h-12 w-12');
    expect(
      classOf(html(<NumberBadge value={1} size="md" />), 'span'),
    ).toContain('h-9 w-9');
    expect(classOf(html(<NumberBadge value={1} />), 'span')).toContain(
      'bg-flame',
    );
    expect(
      classOf(html(<NumberBadge value={1} tone="quiet" />), 'span'),
    ).toContain('bg-ink/10');
  });
});
