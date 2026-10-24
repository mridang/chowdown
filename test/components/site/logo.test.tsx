import { describe, expect, it } from '@jest/globals';

import { Logo } from '@/components/site/logo';
import { classOf, html } from '../render';

describe('Logo', () => {
  it('is the wordmark and a descriptor, linking home', () => {
    const out = html(<Logo />);
    expect(out).toContain('href="/"');
    expect(out).toContain('chowdown');
    expect(out).toContain('Recipe keeper');
  });

  it('accepts extra classes, such as the footer scaling it up', () => {
    expect(classOf(html(<Logo className="scale-125" />), 'a')).toContain(
      'scale-125',
    );
  });
});
