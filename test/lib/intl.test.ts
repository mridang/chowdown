import { describe, expect, it } from '@jest/globals';

import {
  compareText,
  countOf,
  foldText,
  formatQuantityNumber,
  listAnd,
  listOr,
  relativeTime,
} from '../../src/lib/intl';

describe('compareText', () => {
  it('alphabetises accented letters with their base letter', () => {
    expect(['Eggs', 'Éclair', 'Zucchini', 'Apple'].sort(compareText)).toEqual([
      'Apple',
      'Éclair',
      'Eggs',
      'Zucchini',
    ]);
  });

  it('compares digit runs as numbers', () => {
    expect(['Recipe 10', 'Recipe 2', 'Recipe 1'].sort(compareText)).toEqual([
      'Recipe 1',
      'Recipe 2',
      'Recipe 10',
    ]);
  });

  it('treats case and accent differences as ties', () => {
    expect(compareText('apple', 'Apple')).toBe(0);
    expect(compareText('creme', 'Crème')).toBe(0);
  });
});

describe('foldText', () => {
  it('removes accents and case', () => {
    expect(foldText('Crème Brûlée')).toBe('creme brulee');
    expect(foldText('Albóndigas')).toBe('albondigas');
  });

  it('lets a plain search find an accented title', () => {
    expect(foldText('Crème brûlée').includes(foldText('CREME'))).toBe(true);
  });
});

describe('countOf', () => {
  it('uses the singular for one and the plural otherwise', () => {
    expect(countOf(1, 'recipe')).toBe('1 recipe');
    expect(countOf(0, 'recipe')).toBe('0 recipes');
    expect(countOf(2, 'recipe')).toBe('2 recipes');
  });

  it('accepts an irregular plural and groups large numbers', () => {
    expect(countOf(2, 'cherry', 'cherries')).toBe('2 cherries');
    expect(countOf(1234, 'recipe')).toBe('1,234 recipes');
  });
});

describe('formatQuantityNumber', () => {
  it('drops trailing zeros and never groups digits', () => {
    expect(formatQuantityNumber(0.5)).toBe('0.5');
    expect(formatQuantityNumber(250)).toBe('250');
    expect(formatQuantityNumber(1500)).toBe('1500');
    expect(formatQuantityNumber(1.256)).toBe('1.26');
  });

  it('honours the requested precision', () => {
    expect(formatQuantityNumber(1.256, 1)).toBe('1.3');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('says "now" within a minute', () => {
    expect(relativeTime(ago(20_000), now)).toBe('now');
  });

  it('picks a sensible unit', () => {
    expect(relativeTime(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe('3 hours ago');
    expect(relativeTime(ago(24 * 3_600_000), now)).toBe('yesterday');
    expect(relativeTime(ago(3 * 86_400_000), now)).toBe('3 days ago');
    expect(relativeTime(ago(14 * 86_400_000), now)).toBe('2 weeks ago');
    expect(relativeTime(ago(400 * 86_400_000), now)).toBe('last year');
  });

  it('handles the future too', () => {
    expect(relativeTime(new Date(now.getTime() + 2 * 3_600_000), now)).toBe(
      'in 2 hours',
    );
  });
});

describe('lists', () => {
  it('joins with and / or in natural English', () => {
    expect(listAnd(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(listOr(['METRIC', 'US', 'IMPERIAL'])).toBe(
      'METRIC, US, or IMPERIAL',
    );
    expect(listOr(['one'])).toBe('one');
  });
});
