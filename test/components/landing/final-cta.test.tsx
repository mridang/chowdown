import { describe, expect, it } from '@jest/globals';

import { FinalCta } from '../../../src/components/landing/final-cta';
import { html } from '../render';

describe('FinalCta', () => {
  const out = html(<FinalCta />);

  it('invites people to start and offers the sign-in link', () => {
    expect(out).toContain('Start your collection today');
    expect(out).toContain('href="/api/auth/login"');
  });
});
