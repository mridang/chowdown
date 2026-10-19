import { describe, expect, it } from '@jest/globals';

import {
  AMOUNT_PATTERN,
  parseAmount,
} from '../../../src/components/recipe/amount';

describe('parseAmount', () => {
  it.each([
    ['5', 5],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['1/2', 0.5],
    ['3/4', 0.75],
    ['1 1/2', 1.5],
    ['½', 0.5],
    ['¾', 0.75],
    ['1½', 1.5],
    ['2 ½', 2.5],
    ['  7 ', 7],
  ])('reads %p as %p', (text, value) => {
    expect(parseAmount(text)).toBeCloseTo(value, 5);
  });

  it('reads a third as a third', () => {
    expect(parseAmount('⅓')).toBeCloseTo(1 / 3, 5);
    expect(parseAmount('2/3')).toBeCloseTo(2 / 3, 5);
  });

  it.each(['', 'some', 'to taste', '1/0x', 'a', '1 2 3'])(
    'is null for %p',
    (text) => {
      expect(parseAmount(text)).toBeNull();
    },
  );

  it('is null rather than infinite when dividing by zero', () => {
    expect(parseAmount('1/0')).toBeNull();
  });
});

describe('AMOUNT_PATTERN', () => {
  const match = (text: string) =>
    new RegExp(`^(?:${AMOUNT_PATTERN})$`).test(text);

  it('matches every form parseAmount reads', () => {
    ['5', '1.5', '1/2', '1 1/2', '½', '1½'].forEach((text) =>
      expect(match(text)).toBe(true),
    );
  });

  it('has no capture groups, so it can sit inside bigger patterns', () => {
    expect(new RegExp(`(?:${AMOUNT_PATTERN})`).exec('x')).toBeNull();
    expect(new RegExp(`(${AMOUNT_PATTERN})`).exec('1 1/2')).toHaveLength(2);
  });
});
