import { describe, expect, it } from '@jest/globals';

import { cleanTitle, levelOf, toneFor } from '@/domain/recipe/card-style';

describe('cleanTitle', () => {
  it('keeps the part before the first separator', () => {
    expect(cleanTitle('Chicken Chettinad | Chettinad Chicken Recipe')).toBe(
      'Chicken Chettinad',
    );
    expect(cleanTitle('Dal – the easy way')).toBe('Dal');
  });

  it('leaves a plain title and hyphenated words alone', () => {
    expect(cleanTitle('Stir-fried greens')).toBe('Stir-fried greens');
  });
});

describe('toneFor', () => {
  it('is stable for the same text', () => {
    expect(toneFor('abc')).toBe(toneFor('abc'));
  });
});

describe('levelOf', () => {
  it('knows the three levels', () => {
    expect(levelOf('Easy')).toBe('Easy');
    expect(levelOf('Medium')).toBe('Medium');
    expect(levelOf('Hard')).toBe('Hard');
  });

  it('is nothing for anything else', () => {
    expect(levelOf('easy')).toBeUndefined();
    expect(levelOf(undefined)).toBeUndefined();
  });
});

const FAST_MS = 1000;

describe('cleanTitle separators (linear-time rewrite)', () => {
  it.each([
    ['Chicken Chettinad | Chettinad Recipe', 'Chicken Chettinad'],
    ['A|B', 'A|B'],
    ['A | B | C', 'A'],
    ['  | x', '  | x'],
    ['A \u2014  B', 'A'],
    ['plain', 'plain'],
  ])(
    'keeps the part before the first padded separator %j',
    (input, expected) => {
      expect(cleanTitle(input as string)).toEqual(expected);
    },
  );
  it('scans on a long adversarial input', () => {
    const started = performance.now();
    cleanTitle(`${' '.repeat(100_000)}x${' '.repeat(100_000)}`);
    cleanTitle('| '.repeat(50_000));
    expect(performance.now() - started).toBeLessThan(FAST_MS);
  });
});

describe('toneFor characters outside the BMP', () => {
  it.each([
    ['Dal \u{1F35B}', 'forest'],
    ['\u{1F355}\u{1F355}', 'flame'],
    ['plain', 'ink'],
    ['\u00E9', 'sand'],
    ['\uD800x', 'sand'],
    ['\u{1D49C}bc', 'flame'],
    ['\u65E5\u672C', 'sand'],
  ])('keeps the tone of %j', (name, tone) => {
    expect(toneFor(name)).toBe(tone);
  });
});
