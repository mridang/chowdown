import { describe, expect, it } from '@jest/globals';

import { minutesOf } from '@/domain/recipe/minutes';

describe('minutesOf', () => {
  it('reads minutes and hours', () => {
    expect(minutesOf('35 minutes')).toBe(35);
    expect(minutesOf('1 hour 20 min')).toBe(80);
    expect(minutesOf('2 hours')).toBe(120);
    expect(minutesOf('1.5 hours')).toBe(90);
  });

  it('reads the Cooklang quantity form and bare numbers', () => {
    expect(minutesOf('15%minutes')).toBe(15);
    expect(minutesOf('45')).toBe(45);
  });

  it('is undefined for nothing usable', () => {
    expect(minutesOf(undefined)).toBeUndefined();
    expect(minutesOf('')).toBeUndefined();
    expect(minutesOf('a while')).toBeUndefined();
  });
});
