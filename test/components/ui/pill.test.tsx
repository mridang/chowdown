import { describe, expect, it } from '@jest/globals';

import { PillLink } from '../../../src/components/ui/pill';
import { classOf, html } from '../render';

describe('PillLink', () => {
  it('is a link to where it points', () => {
    const out = html(<PillLink href="/app?fav=1">Favourites</PillLink>);
    expect(out).toContain('href="/app?fav=1"');
    expect(out).toContain('Favourites');
  });

  it('is an outline by default and a solid pill that stands out on request', () => {
    expect(classOf(html(<PillLink href="/">x</PillLink>), 'a')).toContain(
      'border-field',
    );
    const solid = classOf(
      html(
        <PillLink href="/" variant="solid">
          x
        </PillLink>,
      ),
      'a',
    );
    expect(solid).toContain('bg-ink');
    expect(solid).toContain('text-white');
  });

  it('has two heights, and the shared focus ring', () => {
    expect(
      classOf(
        html(
          <PillLink href="/" size="sm">
            x
          </PillLink>,
        ),
        'a',
      ),
    ).toContain('h-8');
    expect(classOf(html(<PillLink href="/">x</PillLink>), 'a')).toContain(
      'h-9',
    );
    expect(classOf(html(<PillLink href="/">x</PillLink>), 'a')).toContain(
      'focus-ring',
    );
  });
});
