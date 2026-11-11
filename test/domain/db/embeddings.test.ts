import { describe, expect, it } from '@jest/globals';

import {
  deleteEmbeddingsNotIn,
  deleteOrphanEmbeddings,
  listEmbeddings,
  saveSimilarLists,
  upsertEmbedding,
} from '@/domain/db/embeddings';
import { fakeDb } from '../../lib/core/db/fake-db';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

describe('listEmbeddings', () => {
  it("lists the user's cached rows", async () => {
    const rows = [{ drive_file_id: 'a' }];
    const { db } = fakeDb({ findMany: { embeddings: rows } });
    expect(await listEmbeddings(db, 1)).toBe(rows);
  });
});

/** A real database with recipes (and a user) to hang embeddings on. */
function withRecipes(...ids: readonly string[]) {
  const made = sqliteDatabase(...APP_MIGRATIONS);
  made.raw.exec(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (1, 's', 'a@b.c', 't', 't')",
  );
  const insert = made.raw.prepare(
    "INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (1, ?, ?, '', 't', 't')",
  );
  ids.forEach((id) => insert.run(id, `${id}.cook`));
  return made;
}

/** The `embedded_at` of each recipe, by Drive file id. */
function stamps(made: ReturnType<typeof withRecipes>) {
  return Object.fromEntries(
    made.raw
      .prepare('SELECT drive_file_id, embedded_at FROM recipes')
      .all()
      .map((row) => [row['drive_file_id'], row['embedded_at'] !== null]),
  );
}

const vector = (id: string) => ({
  user_id: 1,
  drive_file_id: id,
  title: id,
  modified_time: null,
  vector: '[1]',
});

describe('embedded_at', () => {
  it('is stamped on the recipe when its embedding is stored', async () => {
    const made = withRecipes('a', 'b');
    await upsertEmbedding(made.db, vector('a'));
    expect(stamps(made)).toEqual({ a: true, b: false });
  });

  it('is cleared with the embedding when the file is gone from the folder', async () => {
    const made = withRecipes('a', 'b');
    await upsertEmbedding(made.db, vector('a'));
    await upsertEmbedding(made.db, vector('b'));
    await deleteEmbeddingsNotIn(made.db, 1, ['a']);
    expect(stamps(made)).toEqual({ a: true, b: false });
    expect(
      made.raw.prepare('SELECT drive_file_id FROM embeddings').all(),
    ).toEqual([{ drive_file_id: 'a' }]);
  });

  it('is kept by the orphan sweep for recipes that still exist', async () => {
    const made = withRecipes('a');
    await upsertEmbedding(made.db, vector('a'));
    made.raw.exec(
      "INSERT INTO embeddings (user_id, drive_file_id, title, vector) VALUES (1, 'orphan', 't', '[1]')",
    );
    await deleteOrphanEmbeddings(made.db, 1);
    expect(stamps(made)).toEqual({ a: true });
    expect(
      made.raw.prepare('SELECT drive_file_id FROM embeddings').all(),
    ).toEqual([{ drive_file_id: 'a' }]);
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
      Object.keys((conflict?.args[0] as { set: object }).set).toSorted((a, b) =>
        a.localeCompare(b),
      ),
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
