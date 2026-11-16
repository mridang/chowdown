import { describe, expect, it } from '@jest/globals';

import { Card } from '@/components/ui/card';
import { cssClassesOf, html } from '../render';

const ESC_P_HYPHEN_DIGITS = /\bp-\d/;

describe('Card', () => {
  it('is a white, bordered, rounded box with room inside', () => {
    const out = html(<Card>hello</Card>);
    expect(cssClassesOf(out, 'div')).toContain('rounded-card');
    expect(cssClassesOf(out, 'div')).toContain('bg-white');
    expect(cssClassesOf(out, 'div')).toContain('border-line');
    expect(out).toContain('hello');
  });

  it('has room inside by default', () => {
    expect(cssClassesOf(html(<Card>x</Card>), 'div')).toContain('p-5 sm:p-8');
  });

  it('offers a few padding sizes, and none', () => {
    expect(cssClassesOf(html(<Card padding="xs">x</Card>), 'div')).toContain(
      'p-3',
    );
    expect(cssClassesOf(html(<Card padding="sm">x</Card>), 'div')).toContain(
      'p-4',
    );
    expect(cssClassesOf(html(<Card padding="lg">x</Card>), 'div')).toContain(
      'p-6 sm:p-8',
    );
    expect(
      cssClassesOf(html(<Card padding="none">x</Card>), 'div'),
    ).not.toMatch(ESC_P_HYPHEN_DIGITS);
  });

  it('can be another element, and passes attributes through', () => {
    const out = html(
      <Card as="section" aria-label="Steps" className="mt-2">
        x
      </Card>,
    );
    expect(out.startsWith('<section')).toBe(true);
    expect(out).toContain('aria-label="Steps"');
    expect(cssClassesOf(out, 'section')).toContain('mt-2');
  });

  it('can be a button and then takes the button’s props', () => {
    const out = html(
      <Card as="button" type="button" padding="lg">
        Choose
      </Card>,
    );
    expect(out.startsWith('<button')).toBe(true);
    expect(out).toContain('type="button"');
  });
});
