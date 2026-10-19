import { describe, expect, it } from '@jest/globals';

import {
  MAX_COOKLANG_BYTES,
  parseNewRecipe,
  parseReplacementCooklang,
} from '../../../src/lib/api/recipe-input';

describe('parseNewRecipe', () => {
  it('accepts a name and Cooklang text', () => {
    expect(parseNewRecipe({ name: ' Soup ', cooklang: 'Boil.' })).toEqual({
      ok: true,
      name: ' Soup ',
      cooklang: 'Boil.',
    });
  });

  it('asks for both when both are missing', () => {
    expect(parseNewRecipe({})).toEqual({
      ok: false,
      errors: ['name: required, up to 200 characters.', 'cooklang: required.'],
    });
  });

  it('refuses a blank or over-long name', () => {
    for (const name of ['  ', 'x'.repeat(201), 5, null]) {
      expect(parseNewRecipe({ name, cooklang: 'x' })).toMatchObject({
        ok: false,
        errors: ['name: required, up to 200 characters.'],
      });
    }
    expect(parseNewRecipe({ name: 'x'.repeat(200), cooklang: 'x' }).ok).toBe(
      true,
    );
  });

  it('refuses blank or non-text Cooklang', () => {
    for (const cooklang of ['  \n', 5, undefined]) {
      expect(parseNewRecipe({ name: 'a', cooklang })).toMatchObject({
        ok: false,
        errors: ['cooklang: required.'],
      });
    }
  });

  it('refuses Cooklang over the size limit, but not at it', () => {
    expect(
      parseNewRecipe({
        name: 'a',
        cooklang: 'x'.repeat(MAX_COOKLANG_BYTES + 1),
      }),
    ).toMatchObject({ ok: false, errors: ['cooklang: too large.'] });
    expect(
      parseNewRecipe({ name: 'a', cooklang: 'x'.repeat(MAX_COOKLANG_BYTES) })
        .ok,
    ).toBe(true);
  });
});

describe('parseReplacementCooklang', () => {
  it('returns the Cooklang text', () => {
    expect(parseReplacementCooklang({ cooklang: 'Boil.' })).toBe('Boil.');
  });

  it('is undefined for anything unusable', () => {
    expect(parseReplacementCooklang(undefined)).toBeUndefined();
    expect(parseReplacementCooklang(null)).toBeUndefined();
    expect(parseReplacementCooklang('x')).toBeUndefined();
    expect(parseReplacementCooklang({})).toBeUndefined();
    expect(parseReplacementCooklang({ cooklang: ' ' })).toBeUndefined();
    expect(parseReplacementCooklang({ cooklang: 5 })).toBeUndefined();
    expect(
      parseReplacementCooklang({
        cooklang: 'x'.repeat(MAX_COOKLANG_BYTES + 1),
      }),
    ).toBeUndefined();
  });
});
