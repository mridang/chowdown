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

  it('can be plain, in ordinary ink instead of the quiet note colour', () => {
    const out = html(<Callout tone="plain">x</Callout>);
    expect(classOf(out, 'div')).toContain('bg-sand');
    expect(classOf(out, 'div')).toContain('text-ink');
    expect(classOf(out, 'div')).not.toContain('text-muted');
    expect(out).not.toContain('role=');
  });

  it('can be highlighted', () => {
    expect(
      classOf(html(<Callout tone="highlight">x</Callout>), 'div'),
    ).toContain('bg-marigold/25');
  });
});
