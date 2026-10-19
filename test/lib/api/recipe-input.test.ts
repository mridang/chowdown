import { describe, expect, it } from '@jest/globals';

import {
  MAX_COOKLANG_BYTES,
  MAX_COOKLANG_LINES,
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

describe('line limit', () => {
  it('refuses text with more lines than the limit, but not at it', () => {
    const at = 'x\n'.repeat(MAX_COOKLANG_LINES - 1);
    expect(parseNewRecipe({ name: 'a', cooklang: at }).ok).toBe(true);
    expect(parseNewRecipe({ name: 'a', cooklang: `${at}\n` })).toMatchObject({
      ok: false,
      errors: [`cooklang: at most ${MAX_COOKLANG_LINES} lines.`],
    });
  });

  it('refuses a text of nothing but line breaks that is within the character limit', () => {
    const blank = `x${'\n'.repeat(MAX_COOKLANG_BYTES - 1)}`;
    expect(blank.length).toBe(MAX_COOKLANG_BYTES);
    expect(parseNewRecipe({ name: 'a', cooklang: blank }).ok).toBe(false);
    expect(parseReplacementCooklang({ cooklang: blank }).ok).toBe(false);
  });
});

describe('parseReplacementCooklang', () => {
  it('returns the Cooklang text', () => {
    expect(parseReplacementCooklang({ cooklang: 'Boil.' })).toEqual({
      ok: true,
      cooklang: 'Boil.',
    });
  });

  it('asks for the text when it is missing, blank or not text', () => {
    for (const body of [
      undefined,
      null,
      'x',
      {},
      { cooklang: ' ' },
      { cooklang: 5 },
    ]) {
      expect(parseReplacementCooklang(body)).toEqual({
        ok: false,
        errors: ['cooklang: required.'],
      });
    }
  });

  it('refuses text over the size limit, but not at it', () => {
    expect(
      parseReplacementCooklang({
        cooklang: 'x'.repeat(MAX_COOKLANG_BYTES + 1),
      }),
    ).toEqual({ ok: false, errors: ['cooklang: too large.'] });
    expect(
      parseReplacementCooklang({ cooklang: 'x'.repeat(MAX_COOKLANG_BYTES) }).ok,
    ).toBe(true);
  });
});
