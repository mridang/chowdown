import { asCalls } from '../../calls';
import { describe, expect, it, jest } from '@jest/globals';

import type { EmbeddingRow } from '@/lib/db/embeddings';
import type { Database } from '@/core/db/client';
import type { User } from '@/lib/db/users';
import {
  ensureEmbeddings,
  parseSimilar,
  refreshSimilarLists,
  serializeSimilar,
  similarFromRows,
  topSimilar,
  updateSimilarLists,
  type EmbeddingDeps,
  type SimilarRecipe,
} from '@/lib/recipe/similar';
import { APP_MIGRATIONS } from '../db/migrations';
import { sqliteDatabase } from '../db/sqlite-db';

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

/** Every row's list worked out from scratch, as the first run for a library does. */
const everyList = (list: readonly EmbeddingRow[], n: number) =>
  updateSimilarLists(
    list,
    list.map((r) => r.drive_file_id),
    n,
  );

describe('updateSimilarLists with every recipe changed', () => {
  it("lists each recipe's nearest others, best first, never itself", () => {
    const lists = everyList(rows, 2);
    expect(lists.get('a')!.map((r) => r.id)).toEqual(['b', 'd']);
    expect(lists.get('c')!.map((r) => r.id)).toEqual(['d', 'b']);
    for (const [id, list] of lists) {
      expect(list.map((r) => r.id)).not.toContain(id);
    }
  });

  it('carries titles so a page needs no second lookup', () => {
    expect(everyList(rows, 1).get('a')).toEqual([
      { id: 'b', title: 'Chicken Korma' },
    ]);
  });

  it('returns fewer than n when there are not enough other recipes', () => {
    expect(everyList(rows.slice(0, 2), 5).get('a')).toHaveLength(1);
  });

  it('handles a single recipe', () => {
    expect(everyList(rows.slice(0, 1), 3).get('a')).toEqual([]);
  });
});

/** The same row with its list stored, as a refresh would have left it. */
const withStored = (r: EmbeddingRow, list: readonly SimilarRecipe[]) => ({
  ...r,
  similar: serializeSimilar(list),
});

/** A deterministic pseudo-random sequence, so a failure can be reproduced. */
function sequence(seed: number): () => number {
  const state = { value: seed };
  return () => {
    state.value = (state.value * 1664525 + 1013904223) % 4294967296;
    return state.value / 4294967296;
  };
}

/** `count` rows with distinct random 4-d vectors (so no ties muddy the comparison). */
function randomRows(count: number, seed: number): readonly EmbeddingRow[] {
  const next = sequence(seed);
  return Array.from({ length: count }, (_, i) =>
    row(`r${i}`, `Recipe ${i}`, [next(), next(), next(), next()]),
  );
}

/** The rows with each stored list brought up to date, as the cache holds them after a refresh. */
function settled(list: readonly EmbeddingRow[], n: number) {
  const lists = everyList(list, n);
  return list.map((r) => withStored(r, lists.get(r.drive_file_id) ?? []));
}

describe('updateSimilarLists incrementally', () => {
  const N = 3;

  it.each([7, 8, 9, 10, 11])(
    'gives the same lists as working everything out again, when a recipe is added (seed %i)',
    (seed) => {
      const before = settled(randomRows(12, seed), N);
      const added = row('new', 'Brand new', [0.5, 0.5, 0.5, 0.5]);
      const after = [...before, added];
      const incremental = updateSimilarLists(after, ['new'], N);
      const fresh = everyList(after, N);
      after.forEach((r) => {
        const next =
          incremental.get(r.drive_file_id) ?? parseSimilar(r.similar);
        expect(next).toEqual(fresh.get(r.drive_file_id));
      });
    },
  );

  it.each([21, 22, 23, 24, 25])(
    'gives the same lists as working everything out again, when a recipe changes (seed %i)',
    (seed) => {
      const before = settled(randomRows(12, seed), N);
      const edited = before.map((r) =>
        r.drive_file_id === 'r4'
          ? row('r4', 'Edited', [0.9, 0.1, 0.9, 0.1])
          : r,
      );
      const incremental = updateSimilarLists(
        edited.map((r) =>
          r.drive_file_id === 'r4' ? { ...r, similar: before[4]!.similar } : r,
        ),
        ['r4'],
        N,
      );
      const fresh = everyList(edited, N);
      edited.forEach((r) => {
        const next =
          incremental.get(r.drive_file_id) ?? parseSimilar(r.similar);
        expect(next).toEqual(fresh.get(r.drive_file_id));
      });
    },
  );

  it('repairs the lists that named a recipe that has since been removed', () => {
    const before = settled(randomRows(12, 3), N);
    const after = before.filter((r) => r.drive_file_id !== 'r0');
    const incremental = updateSimilarLists(after, [], N);
    const fresh = everyList(after, N);
    after.forEach((r) => {
      const next = incremental.get(r.drive_file_id) ?? parseSimilar(r.similar);
      expect(next).toEqual(fresh.get(r.drive_file_id));
    });
  });

  it('leaves out the recipes whose lists cannot have changed', () => {
    const before = settled(randomRows(30, 5), N);
    // A far-away recipe that is nobody's nearest neighbour is only compared
    // with each list's worst entry, not worked out against all 30.
    const far = row('far', 'Far', [50, -50, 50, -50]);
    const lists = updateSimilarLists([...before, far], ['far'], N);
    expect(lists.has('far')).toBe(true);
    const unchanged = [...lists].filter(
      ([id, list]) =>
        id !== 'far' &&
        JSON.stringify(list) ===
          JSON.stringify(
            parseSimilar(before.find((r) => r.drive_file_id === id)!.similar),
          ),
    );
    expect(unchanged.length).toBeGreaterThan(0);
  });

  it('works out a recipe that has no list yet and slots it into the others', () => {
    const before = settled(randomRows(8, 9), N);
    const fresh = row('fresh', 'Fresh', [0.2, 0.2, 0.2, 0.2]);
    // Nothing names it as changed: its empty list is what gives it away.
    const lists = updateSimilarLists([...before, fresh], [], N);
    expect(lists.get('fresh')).toHaveLength(N);
    const full = everyList([...before, fresh], N);
    expect(
      [...lists].every(([id, list]) => full.get(id)?.length === list.length),
    ).toBe(true);
  });

  it('writes nothing for a library whose lists are all current', () => {
    const current = settled(randomRows(6, 1), N);
    expect(updateSimilarLists(current, [], N).size).toBe(0);
  });
});

describe('refreshSimilarLists', () => {
  /** A database holding `list` as one person's embeddings. */
  function stored(list: readonly EmbeddingRow[]) {
    const made = sqliteDatabase(...APP_MIGRATIONS);
    const insert = made.raw.prepare(
      'INSERT INTO embeddings (user_id, drive_file_id, title, vector, similar) VALUES (1, ?, ?, ?, ?)',
    );
    list.forEach((r) =>
      insert.run(r.drive_file_id, r.title, r.vector, r.similar),
    );
    return made;
  }

  const similarOf = (made: ReturnType<typeof stored>, id: string) =>
    parseSimilar(
      String(
        made.raw
          .prepare('SELECT similar FROM embeddings WHERE drive_file_id = ?')
          .get(id)?.['similar'],
      ),
    );

  it('fills in every list for a library that has none', async () => {
    const made = stored(rows);
    await refreshSimilarLists(made.db, 1);
    expect(similarOf(made, 'a').map((r) => r.id)).toEqual(['b', 'd', 'c']);
  });

  it('after one recipe is added, stores its list and puts it in the lists it belongs in', async () => {
    const made = stored(settled(rows, 6));
    made.raw
      .prepare(
        "INSERT INTO embeddings (user_id, drive_file_id, title, vector) VALUES (1, 'e', 'Chicken Tikka', '[0.95,0.05]')",
      )
      .run();
    await refreshSimilarLists(made.db, 1, ['e']);
    expect(similarOf(made, 'e').map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(similarOf(made, 'a').map((r) => r.id)).toEqual(['e', 'b', 'd', 'c']);
  });

  it('does not write rows whose list came out the same', async () => {
    const made = stored(settled(rows, 6));
    const before = made.raw.prepare('SELECT * FROM embeddings').all();
    await refreshSimilarLists(made.db, 1, ['a']);
    expect(made.raw.prepare('SELECT * FROM embeddings').all()).toEqual(before);
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
    expect(asCalls(deps.readFile)).toHaveBeenCalledWith('n', 'tok');
    expect(asCalls(deps.save)).toHaveBeenCalledWith(db, {
      user_id: 2,
      drive_file_id: 'n',
      title: 'New',
      modified_time: 'm2',
      vector: '[0.25,0.75]',
    });
    expect(asCalls(deps.refreshLists)).toHaveBeenCalledWith(db, 2, ['n']);
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
    expect(asCalls(deps.save)).not.toHaveBeenCalled();
    expect(asCalls(deps.refreshLists)).not.toHaveBeenCalled();
    expect(asCalls(deps.prune)).toHaveBeenCalledWith(db, 2, ['a']);
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
    expect(asCalls(deps.save)).toHaveBeenCalledWith(db, {
      user_id: 2,
      drive_file_id: 'a',
      title: 'Title a',
      modified_time: 'm9',
      vector: JSON.stringify([1, 0]),
    });
    expect(asCalls(deps.refreshLists)).not.toHaveBeenCalled();
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
    expect(asCalls(deps.refreshLists)).toHaveBeenCalledTimes(1);
  });

  it('refreshes the lists when a recipe has left the folder', async () => {
    const deps = fakes([cached('a', 'm1'), cached('gone', 'm1')]);
    await ensureEmbeddings(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'm1' }],
      'tok',
      deps,
    );
    expect(asCalls(deps.prune)).toHaveBeenCalledWith(db, 2, ['a']);
    expect(asCalls(deps.refreshLists)).toHaveBeenCalledTimes(1);
  });

  it('returns the rows as they stand after the update', async () => {
    const rowsAfter = [cached('a', 'm1')];
    const deps = fakes(rowsAfter);
    expect(await ensureEmbeddings(user, [], 'tok', deps)).toBe(rowsAfter);
  });
});
