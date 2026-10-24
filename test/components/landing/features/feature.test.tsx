import { describe, expect, it } from '@jest/globals';

import { Feature } from '@/components/landing/features/feature';
import { html } from '../../render';

const feature = (flip?: boolean) =>
  html(
    <Feature eyebrow="Eyebrow" title="Title" body="Body text" flip={flip}>
      <span>picture</span>
    </Feature>,
  );

describe('Feature', () => {
  it('shows the eyebrow, heading, paragraph and picture', () => {
    const out = feature();
    expect(out).toContain('Eyebrow');
    expect(out).toContain('<h2');
    expect(out).toContain('Title');
    expect(out).toContain('Body text');
    expect(out).toContain('picture');
  });

  it('swaps the sides only when flipped', () => {
    expect(feature()).not.toContain('lg:order');
    expect(feature(true)).toContain('lg:order-2');
    expect(feature(true)).toContain('lg:order-1');
  });
});
