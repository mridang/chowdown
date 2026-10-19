import { describe, expect, it } from '@jest/globals';

import { Facts } from '../../../src/components/landing/facts';
import { html } from '../render';

describe('Facts', () => {
  it('is a description list of three figures', () => {
    const out = html(<Facts />);
    expect(out).toContain('<dl');
    expect(out.match(/<dt/g)).toHaveLength(3);
    expect(out.match(/<dd/g)).toHaveLength(3);
    expect(out).toContain('1 folder');
    expect(out).toContain('.cook');
    expect(out).toContain('0 ads');
  });
});
