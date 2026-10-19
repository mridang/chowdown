import { describe, expect, it } from '@jest/globals';

import { Callout } from '../../../src/components/ui/callout';
import { classOf, html } from '../render';

describe('Callout', () => {
  it('is a quiet note by default, not announced', () => {
    const out = html(<Callout>note</Callout>);
    expect(classOf(out, 'div')).toContain('bg-sand');
    expect(out).not.toContain('role=');
  });

  it('announces an error to screen readers', () => {
    const out = html(<Callout tone="error">bad</Callout>);
    expect(out).toContain('role="alert"');
    expect(classOf(out, 'div')).toContain('text-red-800');
  });

  it('comes inline or as a wider banner', () => {
    expect(classOf(html(<Callout>x</Callout>), 'div')).toContain(
      'rounded-control',
    );
    expect(classOf(html(<Callout shape="banner">x</Callout>), 'div')).toContain(
      'rounded-card',
    );
  });

  it('can be highlighted', () => {
    expect(
      classOf(html(<Callout tone="highlight">x</Callout>), 'div'),
    ).toContain('bg-marigold/25');
  });
});
