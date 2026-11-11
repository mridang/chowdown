import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import type { Database } from '@/domain/db/client';
import {
  deleteRecipeData,
  deleteRecipesNotIn,
  findRecipeBySourceUrl,
  getRecipeByFileId,
  listRecipesByUser,
  listRecipesForSync,
  listUnembeddedRecipes,
  staleRecipeIds,
  upsertRecipe,
} from '@/domain/db/recipes';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { indexedPlan, planOf } from '../../lib/core/db/plan';
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

  it('stamps a new recipe with when it was added, and never moves that on an update', async () => {
    const made = seeded();
    const input = { user_id: 1, drive_file_id: 'f1', name: 'f1.cook' };
    await upsertRecipe(made.db, {
      ...input,
      source: 'a',
      added_at: '2020-01-02T00:00:00.000Z',
    });
    await upsertRecipe(made.db, {
      ...input,
      source: 'b',
      added_at: '2026-01-01T00:00:00.000Z',
    });
    const row = made.raw
      .prepare('SELECT first_opened_at AS added FROM recipes')
      .get();
    expect(row).toEqual({ added: '2020-01-02T00:00:00.000Z' });
  });

  it('stamps a new recipe with now when no added time is given', async () => {
    const made = seeded();
    const before = Date.now();
    await save(made, 1, 'f1', 'a');
    const row = made.raw
      .prepare('SELECT first_opened_at AS added FROM recipes')
      .get() as { added: string };
    expect(Date.parse(row.added)).toBeGreaterThanOrEqual(before);
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
      // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
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
    expect(plan.join(' ')).toContain('idx_recipes_user_source_url_name');
  });

  it("lists a user's recipes from the name index, without sorting them", async () => {
    const made = seeded();
    const plan = made.raw
      .prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM recipes WHERE user_id = 1 ORDER BY name',
      )
      .all()
      .map((row) => String(row['detail']))
      .join(' ');
    expect(plan).toContain('idx_recipes_user_name');
    expect(plan).not.toContain('TEMP B-TREE');
  });

  it("lists only the user's own recipes, in name order", async () => {
    const made = seeded();
    await save(made, 1, 'b', '', 'b.cook');
    await save(made, 1, 'a', '', 'a.cook');
    await save(made, 2, 'c', '', 'c.cook');
    const listed = await listRecipesByUser(made.db, 1);
    expect(listed.map((r) => r.drive_file_id)).toEqual(['a', 'b']);
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
    const hit = await findRecipeBySourceUrl(made.db, 1, 'https://site.com/x');
    expect(hit?.drive_file_id).toBe('a');
  });
});

describe('deleteRecipeData', () => {
  it('clears the recipe, its photo addresses, its embedding and its heart in one batch', async () => {
    const statements: unknown[] = [];
    const db = {
      delete: () => ({ where: () => ({}) }),
      batch: async (list: unknown[]) => {
        statements.push(...list);
        return [];
      },
    } as unknown as Database;
    await deleteRecipeData(db, 1, 'abc');
    expect(statements).toHaveLength(4);
  });
});

describe('recipe_images', () => {
  const A = 'https://img.example.org/a.jpg';
  const B = 'https://img.example.org/b.jpg';
  const images = (made: ReturnType<typeof seeded>) =>
    made.raw
      .prepare(
        'SELECT user_id, drive_file_id, url FROM recipe_images ORDER BY user_id, drive_file_id, url',
      )
      .all();

  it('is filled with the recipe, and marks the recipe as indexed', async () => {
    const made = seeded();
    await save(made, 1, 'f1', `>> images: ${A} ${B}\n`);
    expect(images(made)).toEqual([
      { user_id: 1, drive_file_id: 'f1', url: A },
      { user_id: 1, drive_file_id: 'f1', url: B },
    ]);
    expect(
      made.raw.prepare('SELECT images_indexed AS i FROM recipes').get(),
    ).toEqual({ i: 1 });
  });

  it("is replaced when the recipe's photos change, and emptied when it has none", async () => {
    const made = seeded();
    await save(made, 1, 'f1', `>> images: ${A} ${B}\n`);
    await save(made, 1, 'f1', `>> images: ${B}\n`);
    expect(images(made).map((r) => r['url'])).toEqual([B]);
    await save(made, 1, 'f1', '>> title: none\n');
    expect(images(made)).toEqual([]);
  });

  it('is left alone for other recipes and other people', async () => {
    const made = seeded();
    await save(made, 1, 'f1', `>> images: ${A}\n`);
    await save(made, 1, 'f2', `>> images: ${B}\n`);
    await save(made, 2, 'f3', `>> images: ${A}\n`);
    await save(made, 1, 'f1', `>> images: ${B}\n`);
    expect(images(made).map((r) => [r['drive_file_id'], r['url']])).toEqual([
      ['f1', B],
      ['f2', B],
      ['f3', A],
    ]);
  });

  it('goes with the recipe when it is deleted', async () => {
    const made = seeded();
    await save(made, 1, 'f1', `>> images: ${A}\n`);
    await save(made, 1, 'f2', `>> images: ${B}\n`);
    await deleteRecipeData(made.db, 1, 'f1');
    expect(images(made).map((r) => r['drive_file_id'])).toEqual(['f2']);
  });

  it('goes with the recipe when a sync finds its file gone', async () => {
    const made = seeded();
    await save(made, 1, 'f1', `>> images: ${A}\n`);
    await save(made, 1, 'f2', `>> images: ${B}\n`);
    await deleteRecipesNotIn(made.db, 1, ['f2'], '2999-01-01T00:00:00.000Z');
    expect(images(made).map((r) => r['drive_file_id'])).toEqual(['f2']);
  });

  it('is probed by the covering index on user and address, with no scan', () => {
    const plan = planOf(
      seeded().raw,
      'SELECT 1 FROM recipe_images WHERE user_id = ? AND url = ? LIMIT 1',
      1,
      'x',
    );
    expect(plan).toContain('idx_recipe_images_url');
    expect(indexedPlan(plan)).toEqual({
      usesIndex: true,
      scans: false,
      sorts: false,
    });
  });

  it('finds the recipes still to index through the partial index only', () => {
    const plan = planOf(
      seeded().raw,
      'SELECT drive_file_id, name, source FROM recipes WHERE user_id = ? AND "recipes"."images_indexed" = 0',
      1,
    );
    expect(plan).toContain('idx_recipes_images_unindexed');
    expect(indexedPlan(plan).scans).toBe(false);
  });

  it("clears a recipe's rows by the primary key prefix", () => {
    const plan = planOf(
      seeded().raw,
      'DELETE FROM recipe_images WHERE user_id = ? AND drive_file_id IN (?, ?)',
      1,
      'a',
      'b',
    );
    expect(indexedPlan(plan).scans).toBe(false);
  });
});

describe('listRecipesForSync and deleteRecipesNotIn', () => {
  const FUTURE = '2999-01-01T00:00:00.000Z';

  it("lists the user's recipes without their text, from the name index", async () => {
    const made = seeded();
    await save(made, 1, 'a', 'secret text');
    await save(made, 2, 'b', '');
    const rows = await listRecipesForSync(made.db, 1);
    expect(rows.map((r) => r.drive_file_id)).toEqual(['a']);
    expect(
      Object.keys(rows[0] ?? {}).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['drive_file_id', 'last_opened_at', 'modified_time', 'tags']);
    const plan = planOf(
      made.raw,
      'SELECT drive_file_id, modified_time, tags, last_opened_at FROM recipes WHERE user_id = ?',
      1,
    );
    expect(indexedPlan(plan)).toMatchObject({ usesIndex: true, scans: false });
  });

  it('prunes from the rows it is handed without reading the recipes again', async () => {
    const made = seeded();
    await save(made, 1, 'keep', '');
    await save(made, 1, 'gone', '');
    const cached = await listRecipesForSync(made.db, 1);
    const sent: string[] = [];
    const prepare = made.raw.prepare.bind(made.raw);
    made.raw.prepare = (sql: string) => {
      sent.push(sql);
      return prepare(sql);
    };
    await deleteRecipesNotIn(made.db, 1, ['keep'], FUTURE, cached);
    expect(sent.some((sql) => /^\s*select/i.test(sql))).toBe(false);
    expect(made.raw.prepare('SELECT drive_file_id FROM recipes').all()).toEqual(
      [{ drive_file_id: 'keep' }],
    );
  });

  it('reads the recipes itself when it is not handed any', async () => {
    const made = seeded();
    await save(made, 1, 'keep', '');
    await save(made, 1, 'gone', '');
    await deleteRecipesNotIn(made.db, 1, ['keep'], FUTURE);
    expect(made.raw.prepare('SELECT drive_file_id FROM recipes').all()).toEqual(
      [{ drive_file_id: 'keep' }],
    );
  });
});

describe('migration 0021', () => {
  it('leaves every existing recipe unindexed, to be indexed lazily', async () => {
    const before = APP_MIGRATIONS.filter(
      (file) => Number.parseInt(file, 10) < 21,
    );
    const made = sqliteDatabase(...before);
    made.raw.exec(`
      INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (1, 's', 'a@b.c', 't', 't');
      INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (1, 'a', 'a.cook', '>> images: https://x.test/a.jpg', 't', 't');
    `);
    made.raw.exec(
      await readFile(
        path.join(process.cwd(), 'migrations', '0021_recipe_images.sql'),
        'utf8',
      ),
    );
    expect(
      made.raw.prepare('SELECT images_indexed AS i FROM recipes').get(),
    ).toEqual({ i: 0 });
    expect(made.raw.prepare('SELECT * FROM recipe_images').all()).toEqual([]);
  });
});

describe('listUnembeddedRecipes', () => {
  it('lists the recipes that parse and have no embedding, in name order, up to the limit', async () => {
    const made = seeded();
    await save(made, 1, 'c', '');
    await save(made, 1, 'a', '');
    await save(made, 1, 'b', '');
    await save(made, 1, 'broken', '');
    await save(made, 1, 'done', '');
    await save(made, 2, 'other', '');
    made.raw.exec(
      "UPDATE recipes SET parse_error = 'bad' WHERE drive_file_id = 'broken'; UPDATE recipes SET embedded_at = 't' WHERE drive_file_id = 'done'",
    );
    const rows = await listUnembeddedRecipes(made.db, 1, 2);
    expect(rows.map((r) => r.drive_file_id)).toEqual(['a', 'b']);
    expect(
      Object.keys(rows[0] ?? {}).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['drive_file_id', 'modified_time', 'name', 'source']);
  });

  it('reads only the partial index, with no scan and no sort', () => {
    const made = seeded();
    const plan = planOf(
      made.raw,
      'SELECT drive_file_id, name, source, modified_time FROM recipes WHERE user_id = ? AND embedded_at IS NULL AND parse_error IS NULL ORDER BY name ASC LIMIT ?',
    );
    expect(plan).toContain('idx_recipes_unembedded');
    expect(indexedPlan(plan)).toEqual({
      usesIndex: true,
      scans: false,
      sorts: false,
    });
  });
});

describe('migration 0020', () => {
  it('stamps the recipes that already have an embedding and no others', async () => {
    const before = APP_MIGRATIONS.filter(
      (file) => Number.parseInt(file, 10) < 20,
    );
    const made = sqliteDatabase(...before);
    made.raw.exec(`
      INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (1, 's', 'a@b.c', 't', 't'), (2, 'u', 'c@d.e', 't', 't');
      INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES
        (1, 'has', 'has.cook', '', 't', 't'),
        (1, 'lacks', 'lacks.cook', '', 't', 't'),
        (2, 'theirs', 'theirs.cook', '', 't', 't');
      INSERT INTO embeddings (user_id, drive_file_id, title, vector) VALUES (1, 'has', 't', '[1]'), (1, 'orphan', 't', '[1]'), (1, 'theirs', 't', '[1]');
    `);
    made.raw.exec(
      await readFile(
        path.join(process.cwd(), 'migrations', '0020_recipes_embedded_at.sql'),
        'utf8',
      ),
    );
    const stamped = made.raw
      .prepare(
        'SELECT drive_file_id, embedded_at IS NOT NULL AS s FROM recipes',
      )
      .all()
      .map((row) => [row['drive_file_id'], row['s']]);
    expect(stamped).toEqual([
      ['has', 1],
      ['lacks', 0],
      ['theirs', 0],
    ]);
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
