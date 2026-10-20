import { describe, expect, it } from '@jest/globals';

import { TintTile } from '../../../src/components/ui/tint-tile';
import { classOf, html } from '../render';

describe('TintTile', () => {
  it('wears the tint for its tone', () => {
    expect(classOf(html(<TintTile tone="flame" />), 'div')).toContain(
      'bg-flame/15',
    );
    expect(classOf(html(<TintTile tone="forest" />), 'div')).toContain(
      'bg-forest/15',
    );
    expect(classOf(html(<TintTile tone="ink" />), 'div')).toContain(
      'bg-ink/10',
    );
  });

  it('is decorative and takes its shape from the caller', () => {
    const out = html(<TintTile tone="sand" className="aspect-4/3" />);
    expect(out).toContain('aria-hidden="true"');
    expect(classOf(out, 'div')).toContain('aspect-4/3');
  });
});
