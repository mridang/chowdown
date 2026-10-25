import { describe, expect, it } from '@jest/globals';

import type { Database } from '@/domain/db/client';
import {
  deleteRecipeData,
  findRecipeBySourceUrl,
  getRecipeByFileId,
  staleRecipeIds,
  upsertRecipe,
} from '@/domain/db/recipes';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** A database with every migration applied and two people in it. */
function seeded() {
  const made = sqliteDatabase(...APP_MIGRATIONS);
  const user = made.raw.prepare(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01', '2026-01-01')",
  );
  user.run(1, 'sub-1', 'a@b.com');
  user.run(2, 'sub-2', 'c@d.com');
  return made;
}

/** Cache a recipe for `userId` through the repository. */
const save = (
  made: ReturnType<typeof seeded>,
  userId: number,
  fileId: string,
  source: string,
  name = `${fileId}.cook`,
) =>
  upsertRecipe(made.db, {
    user_id: userId,
    drive_file_id: fileId,
    name,
    source,
  });

describe('upsertRecipe', () => {
  it('inserts a recipe and then updates it in place', async () => {
    const made = seeded();
    await save(made, 1, 'f1', '>> title: One\n');
    await save(made, 1, 'f1', '>> title: One, again\n');
    const rows = made.raw
      .prepare('SELECT source FROM recipes WHERE drive_file_id = ?')
      .all('f1');
    expect(rows).toEqual([{ source: '>> title: One, again\n' }]);
  });

  it('records the normalised source address, or an empty marker when there is none', async () => {
    const made = seeded();
    await save(
      made,
      1,
      'with',
      '>> source: https://www.site.com/a/?utm_source=x\n',
    );
    await save(made, 1, 'without', '>> title: Typed in\n');
    const urls = made.raw
      .prepare(
        'SELECT drive_file_id AS id, source_url AS url FROM recipes ORDER BY id',
      )
      .all();
    expect(urls).toEqual([
      { id: 'with', url: 'site.com/a' },
      { id: 'without', url: '' },
    ]);
  });

  it("refuses to cache a file that is already another person's, and leaves their text alone", async () => {
    const made = seeded();
    await save(made, 1, 'shared', 'first person text');
    await expect(
      save(made, 2, 'shared', 'second person text'),
    ).rejects.toThrow();
    const row = await getRecipeByFileId(made.db, 1, 'shared');
    expect(row?.source).toBe('first person text');
    expect(await getRecipeByFileId(made.db, 2, 'shared')).toBeUndefined();
  });
});

describe('findRecipeBySourceUrl', () => {
  it('matches the same page despite www, query and trailing slash', async () => {
    const made = seeded();
    await save(
      made,
      1,
      'a',
      '>> title: A\n>> source: https://www.site.com/post/a/?utm=1\n',
    );
    const hit = await findRecipeBySourceUrl(
      made.db,
      1,
      'http://site.com/post/a',
    );
    expect(hit?.drive_file_id).toBe('a');
  });

  it('returns undefined for a link not yet imported', async () => {
    const made = seeded();
    await save(made, 1, 'a', '>> source: https://site.com/post/a\n');
    expect(
      await findRecipeBySourceUrl(made.db, 1, 'https://site.com/post/other'),
    ).toBeUndefined();
  });

  it('ignores recipes with no source line', async () => {
    const made = seeded();
    await save(made, 1, 'b', '>> title: B\n');
    expect(
      await findRecipeBySourceUrl(made.db, 1, 'https://site.com/post/a'),
    ).toBeUndefined();
  });

  it("does not find another person's recipe", async () => {
    const made = seeded();
    await save(made, 2, 'theirs', '>> source: https://site.com/post/a\n');
    expect(
      await findRecipeBySourceUrl(made.db, 1, 'https://site.com/post/a'),
    ).toBeUndefined();
  });

  it('looks the address up in the index instead of reading the library', async () => {
    const made = seeded();
    const plan = made.raw
      .prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM recipes WHERE user_id = 1 AND source_url = 'x'",
      )
      .all()
      .map((row) => String(row['detail']));
    expect(plan.join(' ')).toContain('idx_recipes_user_source_url');
  });

  it('finds a recipe cached before the address was indexed, and fills the rest in', async () => {
    const made = seeded();
    // As the previous release (or an old row) leaves it: no source_url.
    const legacy = made.raw.prepare(
      "INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (1, ?, ?, ?, 'n', 'n')",
    );
    legacy.run('old', 'old.cook', '>> source: https://www.site.com/old/\n');
    legacy.run('plain', 'plain.cook', 'no source');
    const hit = await findRecipeBySourceUrl(made.db, 1, 'https://site.com/old');
    expect(hit?.drive_file_id).toBe('old');
    const filled = made.raw
      .prepare(
        'SELECT drive_file_id AS id, source_url AS url FROM recipes ORDER BY id',
      )
      .all();
    expect(filled).toEqual([
      { id: 'old', url: 'site.com/old' },
      { id: 'plain', url: '' },
    ]);
  });

  it('prefers the first recipe by name when a link was imported twice', async () => {
    const made = seeded();
    await save(made, 1, 'b', '>> source: https://site.com/x\n', 'Bravo.cook');
    await save(made, 1, 'a', '>> source: https://site.com/x\n', 'Alpha.cook');
    expect(
      (await findRecipeBySourceUrl(made.db, 1, 'https://site.com/x'))
        ?.drive_file_id,
    ).toBe('a');
  });
});

describe('deleteRecipeData', () => {
  it('clears the recipe, its embedding and its heart in one batch', async () => {
    const statements: unknown[] = [];
    const db = {
      delete: () => ({ where: () => ({}) }),
      batch: async (list: unknown[]) => {
        statements.push(...list);
        return [];
      },
    } as unknown as Database;
    await deleteRecipeData(db, 1, 'abc');
    expect(statements).toHaveLength(3);
  });
});

describe('staleRecipeIds', () => {
  const cached = [
    { id: 'kept', seenAt: '2026-01-01T00:00:00.000Z' },
    { id: 'gone', seenAt: '2026-01-01T00:00:00.000Z' },
    { id: 'saved-during-sync', seenAt: '2026-01-02T00:00:05.000Z' },
  ];

  it('drops what the listing no longer has', () => {
    expect(
      staleRecipeIds(
        cached.slice(0, 2),
        new Set(['kept']),
        '2026-01-02T00:00:00.000Z',
      ),
    ).toEqual(['gone']);
  });

  it('leaves alone a recipe saved after the sync began, which the listing predates', () => {
    expect(
      staleRecipeIds(cached, new Set(['kept']), '2026-01-02T00:00:00.000Z'),
    ).toEqual(['gone']);
  });

  it('drops nothing when every cached recipe is listed', () => {
    expect(
      staleRecipeIds(
        cached,
        new Set(['kept', 'gone', 'saved-during-sync']),
        '2026-01-03T00:00:00.000Z',
      ),
    ).toEqual([]);
  });
});
