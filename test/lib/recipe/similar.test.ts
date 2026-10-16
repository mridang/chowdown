import { describe, expect, it } from '@jest/globals';

import type { EmbeddingRow } from '../../../src/lib/db/embeddings';
import {
  computeSimilarLists,
  parseSimilar,
  serializeSimilar,
  similarFromRows,
} from '../../../src/lib/recipe/similar';

/** An embedding row with the given 2-d vector. */
function row(id: string, title: string, vector: number[]): EmbeddingRow {
  return {
    user_id: 1,
    drive_file_id: id,
    title,
    modified_time: null,
    vector: JSON.stringify(vector),
    similar: null,
  };
}

const rows = [
  row('a', 'Chicken Curry', [1, 0]),
  row('b', 'Chicken Korma', [0.9, 0.1]),
  row('c', 'Chocolate Cake', [0, 1]),
  row('d', 'Brownies', [0.1, 0.9]),
];

describe('computeSimilarLists', () => {
  it("lists each recipe's nearest others, best first, never itself", () => {
    const lists = computeSimilarLists(rows, 2);
    expect(lists.get('a')!.map((r) => r.id)).toEqual(['b', 'd']);
    expect(lists.get('c')!.map((r) => r.id)).toEqual(['d', 'b']);
    for (const [id, list] of lists) {
      expect(list.map((r) => r.id)).not.toContain(id);
    }
  });

  it('carries titles so a page needs no second lookup', () => {
    expect(computeSimilarLists(rows, 1).get('a')).toEqual([
      { id: 'b', title: 'Chicken Korma' },
    ]);
  });

  it('returns fewer than n when there are not enough other recipes', () => {
    expect(computeSimilarLists(rows.slice(0, 2), 5).get('a')).toHaveLength(1);
  });

  it('handles a single recipe', () => {
    expect(computeSimilarLists(rows.slice(0, 1), 3).get('a')).toEqual([]);
  });
});

describe('serializeSimilar / parseSimilar', () => {
  it('round-trips a list', () => {
    const list = [{ id: 'b', title: 'Chicken Korma' }];
    expect(parseSimilar(serializeSimilar(list))).toEqual(list);
  });

  it('returns [] for missing, malformed or wrongly shaped values', () => {
    expect(parseSimilar(null)).toEqual([]);
    expect(parseSimilar('')).toEqual([]);
    expect(parseSimilar('{not json')).toEqual([]);
    expect(parseSimilar('{"id":"x"}')).toEqual([]);
    expect(
      parseSimilar('[{"id":1,"title":"x"},{"id":"ok","title":"Ok"}]'),
    ).toEqual([{ id: 'ok', title: 'Ok' }]);
  });
});

describe('similarFromRows', () => {
  it('ranks the other rows against the chosen one', () => {
    expect(similarFromRows(rows, 'a', 2).map((r) => r.id)).toEqual(['b', 'd']);
  });

  it('is empty when the recipe has no embedding yet', () => {
    expect(similarFromRows(rows, 'missing', 3)).toEqual([]);
  });
});
