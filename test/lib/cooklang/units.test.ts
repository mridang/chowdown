import { describe, expect, it } from '@jest/globals';

import {
  convertQuantity,
  isUnitSystem,
  scaleQuantity,
  toBaseAmount,
} from '@/lib/cooklang';

describe('isUnitSystem', () => {
  it('accepts the three systems and rejects others', () => {
    expect(isUnitSystem('metric')).toBe(true);
    expect(isUnitSystem('us')).toBe(true);
    expect(isUnitSystem('imperial')).toBe(true);
    expect(isUnitSystem('nonsense')).toBe(false);
  });
});

describe('convertQuantity — mass', () => {
  it('metric → US (grams to ounces/pounds)', () => {
    expect(convertQuantity('200 g', 'us')).toBe('7.1 oz');
    expect(convertQuantity('1 kg', 'us')).toBe('2.2 lb');
  });
  it('US → metric (pounds to grams)', () => {
    expect(convertQuantity('1 lb', 'metric')).toBe('454 g');
  });
});

describe('convertQuantity — volume', () => {
  it('metric → US (ml to cups/tbsp)', () => {
    expect(convertQuantity('250 ml', 'us')).toBe('1 cup');
    expect(convertQuantity('1/2 cup', 'us')).toBe('8 tbsp');
  });
  it('US → metric (cups to ml)', () => {
    expect(convertQuantity('2 cups', 'metric')).toBe('473 ml');
  });
});

describe('convertQuantity — temperature', () => {
  it('converts between C and F', () => {
    expect(convertQuantity('180 C', 'us')).toBe('356 °F');
    expect(convertQuantity('350 F', 'metric')).toBe('177 °C');
  });
});

describe('convertQuantity — left untouched', () => {
  it('leaves plain counts and unknown units alone', () => {
    expect(convertQuantity('2', 'us')).toBe('2');
    expect(convertQuantity('2 cloves', 'metric')).toBe('2 cloves');
    expect(convertQuantity('', 'us')).toBe('');
  });
});

describe('scaleQuantity', () => {
  it('scales whole numbers and keeps the unit', () => {
    expect(scaleQuantity('2 tbsp', 2)).toBe('4 tbsp');
    expect(scaleQuantity('300 g', 0.5)).toBe('150 g');
    expect(scaleQuantity('3', 2)).toBe('6');
  });

  it('shows fractions the way a cook writes them', () => {
    expect(scaleQuantity('1/2 cup', 3)).toBe('1 1/2 cup');
    expect(scaleQuantity('1 1/2 tsp', 2)).toBe('3 tsp');
    expect(scaleQuantity('1/4 tsp', 2)).toBe('1/2 tsp');
    expect(scaleQuantity('1 cup', 0.5)).toBe('1/2 cup');
  });

  it('scales both ends of a range', () => {
    expect(scaleQuantity('3-4', 2)).toBe('6-8');
    expect(scaleQuantity('8-10 strips', 0.5)).toBe('4-5 strips');
  });

  it('falls back to a decimal when there is no tidy fraction', () => {
    expect(scaleQuantity('1 cup', 2.4)).toBe('2.4 cup');
  });

  it('leaves non-numeric quantities and a factor of 1 alone', () => {
    expect(scaleQuantity('a pinch', 2)).toBe('a pinch');
    expect(scaleQuantity('2 tbsp', 1)).toBe('2 tbsp');
    expect(scaleQuantity('2 tbsp', 0)).toBe('2 tbsp');
    expect(scaleQuantity('', 2)).toBe('');
  });
});

describe('convertQuantity cups', () => {
  it('says cup for exactly one and cups for more', () => {
    expect(convertQuantity('1 L', 'us')).toBe('4.25 cups');
    expect(convertQuantity('300 ml', 'us')).toBe('1.25 cups');
    expect(convertQuantity('240 ml', 'us')).toBe('1 cup');
  });
});

describe('toBaseAmount', () => {
  it('turns mass and volume into grams and millilitres', () => {
    expect(toBaseAmount('400 g')).toEqual({ dimension: 'mass', amount: 400 });
    expect(toBaseAmount('1 kg')).toEqual({ dimension: 'mass', amount: 1000 });
    expect(toBaseAmount('2 cups')?.dimension).toBe('volume');
    expect(toBaseAmount('500 ml')).toEqual({
      dimension: 'volume',
      amount: 500,
    });
  });

  it('treats a bare number or an unknown unit as a count', () => {
    expect(toBaseAmount('3')).toEqual({ dimension: 'count', amount: 3 });
    expect(toBaseAmount('2 cloves')).toEqual({
      dimension: 'count',
      amount: 2,
      unit: 'cloves',
    });
  });

  it('reads fractions and mixed numbers', () => {
    expect(toBaseAmount('1/2 cup')?.amount).toBeCloseTo(118.294, 2);
    expect(toBaseAmount('1 1/2')?.amount).toBe(1.5);
  });

  it('reads thousands separators and fraction glyphs', () => {
    expect(toBaseAmount('1,000 g')).toEqual({
      dimension: 'mass',
      amount: 1000,
    });
    expect(toBaseAmount('2,5 kg')).toEqual({ dimension: 'mass', amount: 2500 });
    expect(toBaseAmount('1½ cups')?.amount).toBeCloseTo(354.88, 1);
    expect(toBaseAmount('½ tsp')?.dimension).toBe('volume');
  });

  it('is undefined with no number', () => {
    expect(toBaseAmount('a pinch')).toBeUndefined();
    expect(toBaseAmount('')).toBeUndefined();
  });
});

describe('units named like JavaScript built-ins', () => {
  it('are not units, and so leave the quantity alone', () => {
    for (const unit of ['constructor', 'toString', '__proto__']) {
      expect(convertQuantity(`2 ${unit}`, 'metric')).toBe(`2 ${unit}`);
    }
  });
});
