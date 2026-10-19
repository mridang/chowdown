import { describe, expect, it, jest } from '@jest/globals';

import type { EmbeddingRow } from '../../../src/lib/db/embeddings';
import type { Database } from '../../../src/lib/db/client';
import type { User } from '../../../src/lib/db/users';
import {
  computeSimilarLists,
  ensureEmbeddings,
  parseSimilar,
  serializeSimilar,
  similarFromRows,
  topSimilar,
  type EmbeddingDeps,
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

describe('topSimilar', () => {
  const files = [
    { id: 'a', name: 'A.cook' },
    { id: 'b', name: 'B.cook' },
    { id: 'c', name: 'C.cook' },
  ];

  it('returns the files whose vectors lie closest to the query, best first', () => {
    const top = topSimilar(rows, [1, 0], files, 2);
    expect(top.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('leaves out the file being compared against', () => {
    const top = topSimilar(rows, [1, 0], files, 3, 'a');
    expect(top.map((f) => f.id)).toEqual(['b', 'c']);
  });

  it('does not let a stale row for a missing file take one of the places', () => {
    // `b` is the closest match but its file is gone: the two that remain fill
    // both places, instead of one place going to the ghost and being lost.
    const top = topSimilar(
      [
        { drive_file_id: 'b', vector: '[1,0]' },
        { drive_file_id: 'a', vector: '[0.9,0.1]' },
        { drive_file_id: 'c', vector: '[0.5,0.5]' },
      ] as never,
      [1, 0],
      [files[0]!, files[2]!],
      2,
    );
    expect(top.map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('skips embeddings whose file is no longer in the folder', () => {
    const top = topSimilar(rows, [0, 1], [{ id: 'c', name: 'C.cook' }], 4);
    expect(top.map((f) => f.id)).toEqual(['c']);
  });
});

/** What a mocked collaborator looks like to `expect`, without dragging the database's deep types into the comparison. */
type Calls = jest.Mock<(...args: readonly unknown[]) => Promise<unknown>>;

describe('ensureEmbeddings', () => {
  const db = {} as Database;
  const user = { id: 2 } as unknown as User;

  /** An embedding row with a known title and modified time. */
  const cached = (id: string, modified: string | null) => ({
    ...row(id, `Title ${id}`, [1, 0]),
    modified_time: modified,
  });

  /** Fake collaborators over the given cache and Drive files. */
  function fakes(cache: EmbeddingRow[]) {
    const deps: EmbeddingDeps = {
      database: () => db,
      env: () => ({}) as CloudflareEnv,
      listCached: async () => cache,
      save: jest.fn(async () => undefined),
      prune: jest.fn(async () => undefined),
      readFile: jest.fn(async () => '>> title: New\n\nCook @onion{1}.\n'),
      embed: jest.fn(async () => [0.25, 0.75]),
      refreshLists: jest.fn(async () => undefined),
    };
    return deps;
  }

  it('embeds a file that has no cached vector, and refreshes the lists', async () => {
    const deps = fakes([]);
    await ensureEmbeddings(
      user,
      [{ id: 'n', name: 'New.cook', modifiedTime: 'm2' }],
      'tok',
      deps,
    );
    expect(deps.readFile).toHaveBeenCalledWith('n', 'tok');
    expect(deps.save as unknown as Calls).toHaveBeenCalledWith(db, {
      user_id: 2,
      drive_file_id: 'n',
      title: 'New',
      modified_time: 'm2',
      vector: '[0.25,0.75]',
    });
    expect(deps.refreshLists as unknown as Calls).toHaveBeenCalledWith(db, 2);
  });

  it('leaves a current vector alone and does not refresh anything', async () => {
    const deps = fakes([cached('a', 'm1')]);
    await ensureEmbeddings(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'm1' }],
      'tok',
      deps,
    );
    expect(deps.readFile).not.toHaveBeenCalled();
    expect(deps.save as unknown as Calls).not.toHaveBeenCalled();
    expect(deps.refreshLists as unknown as Calls).not.toHaveBeenCalled();
    expect(deps.prune as unknown as Calls).toHaveBeenCalledWith(db, 2, ['a']);
  });

  it('adopts Drive timestamp for a vector made at write time, without re-embedding', async () => {
    const deps = fakes([cached('a', null)]);
    await ensureEmbeddings(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'm9' }],
      'tok',
      deps,
    );
    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.save as unknown as Calls).toHaveBeenCalledWith(db, {
      user_id: 2,
      drive_file_id: 'a',
      title: 'Title a',
      modified_time: 'm9',
      vector: JSON.stringify([1, 0]),
    });
    expect(deps.refreshLists as unknown as Calls).not.toHaveBeenCalled();
  });

  it('re-embeds a file Drive says has changed', async () => {
    const deps = fakes([cached('a', 'old')]);
    await ensureEmbeddings(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'new' }],
      'tok',
      deps,
    );
    expect(deps.embed).toHaveBeenCalledTimes(1);
    expect(deps.refreshLists as unknown as Calls).toHaveBeenCalledTimes(1);
  });

  it('refreshes the lists when a recipe has left the folder', async () => {
    const deps = fakes([cached('a', 'm1'), cached('gone', 'm1')]);
    await ensureEmbeddings(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'm1' }],
      'tok',
      deps,
    );
    expect(deps.prune as unknown as Calls).toHaveBeenCalledWith(db, 2, ['a']);
    expect(deps.refreshLists as unknown as Calls).toHaveBeenCalledTimes(1);
  });

  it('returns the rows as they stand after the update', async () => {
    const rowsAfter = [cached('a', 'm1')];
    const deps = fakes(rowsAfter);
    expect(await ensureEmbeddings(user, [], 'tok', deps)).toBe(rowsAfter);
  });
});
