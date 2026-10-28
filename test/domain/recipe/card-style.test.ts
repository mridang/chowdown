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
