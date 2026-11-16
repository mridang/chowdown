import { describe, expect, it } from '@jest/globals';

// eslint-disable-next-line unicorn/no-keyword-prefix -- the name is exported from its module and used by other modules
import { hashSecret, newSecret } from '@/lib/oauth';

const START_N0_HYPHEN_N9_A = /^[0-9a-f]{64}$/;
const START_CDN_UNDERSCORE_AT_UNDERSCORE = /^cdn_at_[A-Za-z0-9_-]{43}$/;

describe('newSecret', () => {
  it('is prefixed, url-safe and different every time', () => {
    const a = newSecret('cdn_at');
    const b = newSecret('cdn_at');
    expect(a).toMatch(START_CDN_UNDERSCORE_AT_UNDERSCORE);
    expect(a).not.toBe(b);
  });
});

describe('hashSecret', () => {
  it('is a stable 64-character hex digest that is not the secret', async () => {
    const hash = await hashSecret('cdn_at_example');
    expect(hash).toMatch(START_N0_HYPHEN_N9_A);
    expect(hash).toBe(await hashSecret('cdn_at_example'));
    expect(hash).not.toContain('example');
  });

  it('differs for different secrets', async () => {
    expect(await hashSecret('a')).not.toBe(await hashSecret('b'));
  });
});
