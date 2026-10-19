import { describe, expect, it } from '@jest/globals';

import {
  limitArg,
  numberArg,
  stringArg,
  stringListArg,
} from '../../../src/lib/mcp/tool-args';

describe('stringArg', () => {
  it('trims a string and gives empty for anything else', () => {
    expect(stringArg('  hi ')).toBe('hi');
    expect(stringArg(undefined)).toBe('');
    expect(stringArg(5)).toBe('');
    expect(stringArg(null)).toBe('');
  });
});

describe('stringListArg', () => {
  it('takes one value or a list, splitting commas and dropping blanks', () => {
    expect(stringListArg('a, b')).toEqual(['a', 'b']);
    expect(stringListArg(['a', ' ', 'b,c'])).toEqual(['a', 'b', 'c']);
    expect(stringListArg(undefined)).toEqual([]);
  });

  it('counts numbers as strings and ignores other kinds of value', () => {
    expect(stringListArg([5, true, null, {}, 'x'])).toEqual(['5', 'x']);
  });
});

describe('numberArg', () => {
  it('accepts numbers and numeric strings only', () => {
    expect(numberArg(5)).toBe(5);
    expect(numberArg(' 7 ')).toBe(7);
    expect(numberArg('')).toBeUndefined();
    expect(numberArg('abc')).toBeUndefined();
    expect(numberArg(Infinity)).toBeUndefined();
    expect(numberArg(null)).toBeUndefined();
  });
});

describe('limitArg', () => {
  it('defaults to 12 and keeps the limit between 1 and 50', () => {
    expect(limitArg(undefined)).toBe(12);
    expect(limitArg(0)).toBe(1);
    expect(limitArg(-4)).toBe(1);
    expect(limitArg(500)).toBe(50);
    expect(limitArg('7')).toBe(7);
  });

  it('rounds down to a whole number', () => {
    expect(limitArg(2.9)).toBe(2);
  });
});
