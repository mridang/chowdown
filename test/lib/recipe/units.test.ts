import { describe, expect, it } from '@jest/globals';

import { convertQuantity, isUnitSystem } from '../../../src/lib/recipe/units';

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
