import { describe, expect, it } from '@jest/globals';

import { TintTile } from '@/components/ui/tint-tile';
import { cssClassesOf, html } from '../render';

describe('TintTile', () => {
  it('wears the tint for its tone', () => {
    expect(cssClassesOf(html(<TintTile tone="flame" />), 'div')).toContain(
      'bg-flame/15',
    );
    expect(cssClassesOf(html(<TintTile tone="forest" />), 'div')).toContain(
      'bg-forest/15',
    );
    expect(cssClassesOf(html(<TintTile tone="ink" />), 'div')).toContain(
      'bg-ink/10',
    );
  });

  it('is decorative and takes its shape from the caller', () => {
    const out = html(<TintTile tone="sand" className="aspect-4/3" />);
    expect(out).toContain('aria-hidden="true"');
    expect(cssClassesOf(out, 'div')).toContain('aspect-4/3');
  });
});
