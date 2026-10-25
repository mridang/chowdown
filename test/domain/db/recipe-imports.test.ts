import { describe, expect, it } from '@jest/globals';

import {
  createRecipeImport,
  deleteRecipeImport,
  getRecipeImport,
  IMPORT_RETENTION_DAYS,
  listRecipeImports,
  listRecipeImportSummaries,
  MAX_IMPORTS_PER_USER,
  purgeExpiredRecipeImports,
} from '@/domain/db/recipe-imports';
import type { ImportItem } from '@/domain/recipe/prepare-import';
import { fakeDb } from '../../lib/core/db/fake-db';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const items = [{ kind: 'text', status: 'FAILED' }] as unknown as ImportItem[];
const row = {
  id: 'i1',
  user_id: 1,
  status: 'COMPLETED',
  items: JSON.stringify(items),
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('createRecipeImport', () => {
  it('stores the import and returns it with an id and a time', async () => {
    const { db, calls } = fakeDb();
    const created = await createRecipeImport(db, 1, items);
    expect(created).toMatchObject({ status: 'COMPLETED', items });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    const stored = calls.find((c) => c.method === 'values')?.args[0] as {
      items: string;
      user_id: number;
      item_count: number;
    };
    expect(stored.user_id).toBe(1);
    expect(stored.item_count).toBe(1);
    expect(JSON.parse(stored.items)).toEqual(items);
  });
});

/** A database with every migration applied. */
const real = () => sqliteDatabase(...APP_MIGRATIONS);

/** Insert an import row directly, as it would have been stored. */
function insertRow(
  made: ReturnType<typeof real>,
  id: string,
  userId: number,
  createdAt: string,
  itemCount: number | null = 1,
) {
  made.raw
    .prepare(
      "INSERT INTO recipe_imports (id, user_id, status, items, item_count, created_at) VALUES (?, ?, 'COMPLETED', ?, ?, ?)",
    )
    .run(
      id,
      userId,
      JSON.stringify([{ a: 1 }, { b: 2 }]),
      itemCount,
      createdAt,
    );
}

/** The ids of the stored imports of one person, oldest first. */
const idsOf = (made: ReturnType<typeof real>, userId: number) =>
  made.raw
    .prepare(
      'SELECT id FROM recipe_imports WHERE user_id = ? ORDER BY created_at',
    )
    .all(userId)
    .map((row) => String(row['id']));

describe('createRecipeImport retention', () => {
  const days = (n: number) =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  it("drops the same person's imports older than the retention period", async () => {
    const made = real();
    insertRow(made, 'stale', 1, days(IMPORT_RETENTION_DAYS + 1));
    insertRow(made, 'recent', 1, days(1));
    await createRecipeImport(made.db, 1, items);
    expect(idsOf(made, 1)).not.toContain('stale');
    expect(idsOf(made, 1)).toContain('recent');
  });

  it('keeps only the newest imports once the person is over their cap', async () => {
    const made = real();
    for (let n = 0; n < MAX_IMPORTS_PER_USER + 5; n += 1) {
      insertRow(
        made,
        `old-${String(n).padStart(2, '0')}`,
        1,
        days(1 - n / 1000),
      );
    }
    const created = await createRecipeImport(made.db, 1, items);
    const kept = idsOf(made, 1);
    expect(kept).toHaveLength(MAX_IMPORTS_PER_USER);
    expect(kept).toContain(created.id);
    expect(kept).not.toContain('old-00');
  });

  it("never touches another person's imports", async () => {
    const made = real();
    insertRow(made, 'theirs', 2, days(IMPORT_RETENTION_DAYS + 30));
    await createRecipeImport(made.db, 1, items);
    expect(idsOf(made, 2)).toEqual(['theirs']);
  });

  it('records how many drafts the import holds', async () => {
    const made = real();
    const created = await createRecipeImport(made.db, 1, items);
    expect(
      made.raw
        .prepare('SELECT item_count AS n FROM recipe_imports WHERE id = ?')
        .get(created.id),
    ).toEqual({ n: 1 });
  });
});

describe('listRecipeImportSummaries', () => {
  it('lists newest first with the stored count and without the drafts', async () => {
    const made = real();
    insertRow(made, 'a', 1, '2026-01-01T00:00:00.000Z', 3);
    insertRow(made, 'b', 1, '2026-02-01T00:00:00.000Z', 5);
    insertRow(made, 'x', 2, '2026-03-01T00:00:00.000Z', 9);
    expect(await listRecipeImportSummaries(made.db, 1)).toEqual([
      {
        id: 'b',
        status: 'COMPLETED',
        created_at: '2026-02-01T00:00:00.000Z',
        item_count: 5,
      },
      {
        id: 'a',
        status: 'COMPLETED',
        created_at: '2026-01-01T00:00:00.000Z',
        item_count: 3,
      },
    ]);
  });

  it('counts the drafts of an import saved before the count was stored', async () => {
    const made = real();
    insertRow(made, 'legacy', 1, '2026-01-01T00:00:00.000Z', null);
    expect((await listRecipeImportSummaries(made.db, 1))[0]?.item_count).toBe(
      2,
    );
  });

  it('counts damaged stored drafts as none rather than failing', async () => {
    const made = real();
    made.raw
      .prepare(
        "INSERT INTO recipe_imports (id, user_id, status, items, created_at) VALUES ('bad', 1, 'COMPLETED', '{not json', '2026-01-01T00:00:00.000Z')",
      )
      .run();
    expect((await listRecipeImportSummaries(made.db, 1))[0]?.item_count).toBe(
      0,
    );
  });
});

describe('getRecipeImport', () => {
  it('reads the stored drafts back', async () => {
    const { db } = fakeDb({ findFirst: { recipeImports: row } });
    expect(await getRecipeImport(db, 1, 'i1')).toEqual({
      id: 'i1',
      status: 'COMPLETED',
      created_at: row.created_at,
      items,
    });
  });

  it('is undefined for an import the user does not have', async () => {
    const { db } = fakeDb({ findFirst: { recipeImports: undefined } });
    expect(await getRecipeImport(db, 1, 'nope')).toBeUndefined();
  });

  it('reads damaged stored items as no items rather than failing', async () => {
    const { db } = fakeDb({
      findFirst: { recipeImports: { ...row, items: '{"not":"a list"}' } },
    });
    expect((await getRecipeImport(db, 1, 'i1'))?.items).toEqual([]);
  });
});

describe('listRecipeImports', () => {
  it("lists the user's imports", async () => {
    const { db } = fakeDb({ select: [[row]] });
    expect(await listRecipeImports(db, 1)).toHaveLength(1);
  });
});

describe('deleteRecipeImport', () => {
  it('says whether anything was deleted', async () => {
    expect(
      await deleteRecipeImport(
        fakeDb({ delete: [{ meta: { changes: 1 } }] }).db,
        1,
        'i1',
      ),
    ).toBe(true);
    expect(
      await deleteRecipeImport(
        fakeDb({ delete: [{ meta: { changes: 0 } }] }).db,
        1,
        'i1',
      ),
    ).toBe(false);
  });
});

describe('purgeExpiredRecipeImports', () => {
  const at = new Date('2026-06-01T00:00:00.000Z');

  it("deletes everyone's imports past the retention period and keeps the rest", async () => {
    const made = real();
    insertRow(made, 'old-1', 1, '2026-05-01T00:00:00.000Z');
    insertRow(made, 'old-2', 2, '2026-05-20T00:00:00.000Z');
    insertRow(made, 'fresh', 1, '2026-05-30T00:00:00.000Z');
    expect(await purgeExpiredRecipeImports(made.db, at)).toBe(2);
    expect(idsOf(made, 1)).toEqual(['fresh']);
    expect(idsOf(made, 2)).toEqual([]);
  });

  it('deletes nothing when everything is recent', async () => {
    const made = real();
    insertRow(made, 'fresh', 1, '2026-05-31T00:00:00.000Z');
    expect(await purgeExpiredRecipeImports(made.db, at)).toBe(0);
  });

  it('finds the old rows by age through an index', () => {
    const plan = real()
      .raw.prepare(
        "EXPLAIN QUERY PLAN DELETE FROM recipe_imports WHERE created_at < 'x'",
      )
      .all()
      .map((row) => String(row['detail']))
      .join(' ');
    expect(plan).toContain('idx_recipe_imports_created');
  });
});
