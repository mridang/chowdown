import { describe, expect, it } from '@jest/globals';

import { Card } from '../../../src/components/ui/card';
import { classOf, html } from '../render';

describe('Card', () => {
  it('is a white, bordered, rounded box with room inside', () => {
    const out = html(<Card>hello</Card>);
    expect(classOf(out, 'div')).toContain('rounded-card');
    expect(classOf(out, 'div')).toContain('bg-white');
    expect(classOf(out, 'div')).toContain('border-ink/10');
    expect(out).toContain('hello');
  });

  it('offers a few padding sizes, and none', () => {
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
});
