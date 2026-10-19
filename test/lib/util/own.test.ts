import { describe, expect, it } from '@jest/globals';

import { own } from '../../../src/lib/util/own';

describe('own', () => {
  const table = { cup: 240, tbsp: 15 } as const;

  it('finds what the table lists', () => {
    expect(own(table, 'cup')).toBe(240);
  });

  it('finds nothing for a word it does not list', () => {
    expect(own(table, 'pinch')).toBeUndefined();
  });

  it('does not mistake what every object inherits for a listed word', () => {
    for (const word of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
      'valueOf',
    ]) {
      expect(own(table, word)).toBeUndefined();
    }
  });
});
