import { describe, expect, it } from '@jest/globals';

import { ID_CHUNK, chunked } from '@/domain/db/chunk';

describe('chunked', () => {
  it('splits into consecutive pieces of at most the size', () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunked([], 2)).toEqual([]);
  });

  it('defaults to a size comfortably under the 100 parameters D1 allows', () => {
    expect(ID_CHUNK).toBeLessThan(100);
    const ids = Array.from({ length: 120 }, (_, i) => i);
    expect(chunked(ids).map((c) => c.length)).toEqual([50, 50, 20]);
  });
});
