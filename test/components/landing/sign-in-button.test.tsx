import { describe, expect, it } from '@jest/globals';

import { SignInButton } from '@/components/landing/sign-in-button';
import { classOf, html } from '../render';

describe('SignInButton', () => {
  it('is a plain link to the sign-in route, labelled for Google', () => {
    const out = html(<SignInButton />);
    expect(out.startsWith('<a')).toBe(true);
    expect(out).toContain('href="/auth/login"');
    expect(out).toContain('Continue with Google');
  });

  it('is large by default and can be made smaller', () => {
    expect(classOf(html(<SignInButton />), 'a')).toContain('h-12');
    expect(classOf(html(<SignInButton size="md" />), 'a')).toContain('h-10');
  });
});
