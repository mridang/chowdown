/* eslint-disable tailwindcss/no-custom-classname -- fixture class names that are not Tailwind classes. */
import { describe, expect, it } from '@jest/globals';

import { Card } from '@/components/ui/card';
import { classOf, html } from '../render';

describe('Card', () => {
  it('is a white, bordered, rounded box with room inside', () => {
    const out = html(<Card>hello</Card>);
    expect(classOf(out, 'div')).toContain('rounded-card');
    expect(classOf(out, 'div')).toContain('bg-white');
    expect(classOf(out, 'div')).toContain('border-line');
    expect(out).toContain('hello');
  });

  it('has room inside by default', () => {
    expect(classOf(html(<Card>x</Card>), 'div')).toContain('p-5 sm:p-8');
  });

  it('offers a few padding sizes, and none', () => {
    expect(classOf(html(<Card padding="xs">x</Card>), 'div')).toContain('p-3');
    expect(classOf(html(<Card padding="sm">x</Card>), 'div')).toContain('p-4');
    expect(classOf(html(<Card padding="lg">x</Card>), 'div')).toContain(
      'p-6 sm:p-8',
    );
    expect(classOf(html(<Card padding="none">x</Card>), 'div')).not.toMatch(
      /\bp-\d/,
    );
  });

  it('can be another element, and passes attributes through', () => {
    const out = html(
      <Card as="section" aria-label="Steps" className="extra">
        x
      </Card>,
    );
    expect(out.startsWith('<section')).toBe(true);
    expect(out).toContain('aria-label="Steps"');
    expect(classOf(out, 'section')).toContain('extra');
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
