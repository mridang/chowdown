import { describe, expect, it } from '@jest/globals';

import {
  countEmbeddings,
  deleteEmbeddingsNotIn,
  listEmbeddings,
  saveSimilarLists,
  upsertEmbedding,
} from '@/lib/db/embeddings';
import { fakeDb } from './fake-db';

describe('listEmbeddings', () => {
  it("lists the user's cached rows", async () => {
    const rows = [{ drive_file_id: 'a' }];
    const { db } = fakeDb({ findMany: { embeddings: rows } });
    expect(await listEmbeddings(db, 1)).toBe(rows);
  });
});

describe('upsertEmbedding', () => {
  it('inserts, and on a conflict updates title, time and vector', async () => {
    const { db, calls } = fakeDb();
    await upsertEmbedding(db, {
      user_id: 1,
      drive_file_id: 'a',
      title: 'A',
      modified_time: 't',
      vector: '[1]',
    });
    const conflict = calls.find((c) => c.method === 'onConflictDoUpdate');
    expect(
      Object.keys((conflict?.args[0] as { set: object }).set).toSorted(),
    ).toEqual(['modified_time', 'title', 'vector']);
  });
});

describe('deleteEmbeddingsNotIn', () => {
  it('deletes nothing when every cached file is still in the folder', async () => {
    const { db, calls } = fakeDb({ select: [[{ id: 'a' }, { id: 'b' }]] });
    await deleteEmbeddingsNotIn(db, 1, ['a', 'b', 'c']);
    expect(calls.some((c) => c.method === 'delete')).toBe(false);
  });

  it('deletes the files that are gone, a few ids at a time', async () => {
    const cached = Array.from({ length: 120 }, (_, i) => ({ id: `f${i}` }));
    const { db, calls } = fakeDb({ select: [cached] });
    await deleteEmbeddingsNotIn(db, 1, ['f0']);
    // 119 stale ids at 50 per statement: three statements.
    expect(calls.filter((c) => c.method === 'delete')).toHaveLength(3);
  });
});

describe('saveSimilarLists', () => {
  it('writes the lists in batches of 50', async () => {
    const lists = new Map(
      Array.from({ length: 120 }, (_, i) => [`f${i}`, '[]'] as const),
    );
    const { db, batches } = fakeDb();
    await saveSimilarLists(db, 1, lists);
    expect(batches.map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('does not touch the database for no lists', async () => {
    const { db, batches } = fakeDb();
    await saveSimilarLists(db, 1, new Map());
    expect(batches).toEqual([]);
  });
});

describe('countEmbeddings', () => {
  it('counts the cached rows', async () => {
    expect(await countEmbeddings(fakeDb({ select: [[{ n: 4 }]] }).db, 1)).toBe(
      4,
    );
  });

  it('is zero when there is no answer', async () => {
    expect(await countEmbeddings(fakeDb({ select: [[]] }).db, 1)).toBe(0);
  });
});
