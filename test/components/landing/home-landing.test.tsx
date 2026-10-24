import { describe, expect, it } from '@jest/globals';

import { HomeLanding } from '@/components/landing/home-landing';
import { classOf, html } from '../render';

describe('HomeLanding', () => {
  it('has a single top heading and the sections it links to', () => {
    const out = html(<HomeLanding />);
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('id="features"');
    expect(out).toContain('id="faq"');
  });

  it('shows the sign-in failure notice only after a failed sign-in', () => {
    const note = 'Signing in with Google didn’t work';
    expect(html(<HomeLanding />)).not.toContain(note);
    const out = html(<HomeLanding signInFailed />);
    expect(out).toContain(note);
    expect(out).toContain('rounded-card');
    expect(classOf(out, 'div')).toContain('pt-6');
  });
});
