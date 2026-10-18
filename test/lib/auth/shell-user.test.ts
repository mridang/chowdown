import { describe, expect, it } from '@jest/globals';

import { firstNameOf } from '../../../src/lib/auth/shell-user';

describe('firstNameOf', () => {
  it('takes the first word of a name', () => {
    expect(firstNameOf('Mridang Agarwalla', 'm@x.com')).toBe('Mridang');
    expect(firstNameOf('  Ada   Lovelace ', 'a@x.com')).toBe('Ada');
  });

  it('falls back to the start of the email when there is no name', () => {
    expect(firstNameOf(null, 'grace.hopper@navy.mil')).toBe('grace.hopper');
    expect(firstNameOf('', 'x@y.com')).toBe('x');
    expect(firstNameOf(undefined, 'z@y.com')).toBe('z');
  });
});
