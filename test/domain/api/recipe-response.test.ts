import { describe, expect, it } from '@jest/globals';

import {
  COOKLANG_TYPE,
  JSON_LD_TYPE,
  wantedType,
} from '@/domain/api/recipe-response';

describe('wantedType', () => {
  it('gives JSON unless another representation is asked for', () => {
    expect(wantedType(null)).toBe('json');
    expect(wantedType('application/json')).toBe('json');
    expect(wantedType('*/*')).toBe('json');
  });

  it('gives raw Cooklang or JSON-LD when asked', () => {
    expect(wantedType(COOKLANG_TYPE)).toBe('cooklang');
    expect(wantedType(`text/html, ${JSON_LD_TYPE};q=0.9`)).toBe('ld');
    expect(wantedType('TEXT/X-COOKLANG')).toBe('cooklang');
  });
});
