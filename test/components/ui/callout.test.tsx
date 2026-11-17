import { describe, expect, it } from '@jest/globals';

import { Callout } from '@/components/ui/callout';
import { cssClassesOf, html } from '../render';

describe('Callout', () => {
  it('is a quiet note by default, not announced', () => {
    const out = html(<Callout>note</Callout>);
    expect(cssClassesOf(out, 'div')).toContain('bg-sand');
    expect(out).not.toContain('role=');
  });

  it('announces an error to screen readers', () => {
    const out = html(<Callout tone="error">bad</Callout>);
    expect(out).toContain('role="alert"');
    expect(cssClassesOf(out, 'div')).toContain('text-red-800');
  });

  it('comes inline or as a wider banner', () => {
    expect(cssClassesOf(html(<Callout>x</Callout>), 'div')).toContain(
      'rounded-control',
    );
    expect(
      cssClassesOf(html(<Callout layout="banner">x</Callout>), 'div'),
    ).toContain('rounded-card');
  });

  it('can be plain, in ordinary ink instead of the quiet note colour', () => {
    const out = html(<Callout tone="plain">x</Callout>);
    const classes = cssClassesOf(out, 'div');
    expect(classes).toContain('bg-sand');
    expect(classes).toContain('text-ink');
    expect(classes).not.toContain('text-muted');
    expect(out).not.toContain('role=');
  });

  it('can be highlighted', () => {
    expect(
      cssClassesOf(html(<Callout tone="highlight">x</Callout>), 'div'),
    ).toContain('bg-marigold/25');
  });
});
