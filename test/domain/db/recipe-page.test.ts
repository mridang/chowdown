import { describe, expect, it } from '@jest/globals';

import type { Database } from '@/domain/db/client';
import { getAppPageRows, getRecipePageRows } from '@/domain/db/recipe-page';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** A query builder stub: every method chains, and the batch returns canned rows. */
function dbReturning(results: unknown[]): { db: Database; queries: number } {
  const state = { queries: 0 };
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'from', 'where', 'limit']) {
    chain[method] = () => chain;
  }
  const db = {
    select: () => {
      state.queries += 1;
      return chain;
    },
    batch: async (queries: unknown[]) => {
      expect(queries).toHaveLength(results.length);
      return results;
    },
  } as unknown as Database;
  return {
    db,
    get queries() {
      return state.queries;
    },
  };
}

describe('getRecipePageRows', () => {
  it('reads everything the page needs in one batch', async () => {
    const recipe = { drive_file_id: 'r1', name: 'R.cook', source: '' };
    const similar = { drive_file_id: 's1', name: 'S.cook', source: '' };
    const stub = dbReturning([
      [recipe],
      [{ id: 'r1' }],
      [{ similar: '[{"id":"s1","title":"S"}]' }],
      [similar],
      [{ id: 's1' }],
      [{ units: 'metric', epoch: 4 }],
    ]);
    const rows = await getRecipePageRows(stub.db, 1, 'r1');
    expect(stub.queries).toBe(6);
    expect(rows).toEqual({
      recipe,
      favourite: true,
      similarJson: '[{"id":"s1","title":"S"}]',
      similarRecipes: [similar],
      similarFavouriteIds: ['s1'],
      units: 'metric',
      sessionEpoch: 4,
    });
  });

  it('copes with a recipe that has no favourite, similar list or user row', async () => {
    const stub = dbReturning([[], [], [], [], [], []]);
    const rows = await getRecipePageRows(stub.db, 1, 'gone');
    expect(rows).toEqual({
      favourite: false,
      similarJson: null,
      similarRecipes: [],
      similarFavouriteIds: [],
      units: null,
    });
  });
});

describe('getAppPageRows', () => {
  it('reads the user, recipes and hearts without touching the embeddings table', async () => {
    const made = sqliteDatabase(...APP_MIGRATIONS);
    made.raw.exec(`
      INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (1, 's', 'a@b.c', 't', 't');
      INSERT INTO recipes (user_id, drive_file_id, name, source, embedded_at, first_opened_at, last_opened_at) VALUES (1, 'a', 'a.cook', '', 'stamp', 't', 't');
      INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (1, 'a', 't');
    `);
    const sent: string[] = [];
    const prepare = made.raw.prepare.bind(made.raw);
    made.raw.prepare = (sql: string) => {
      sent.push(sql);
      return prepare(sql);
    };
    const rows = await getAppPageRows(made.db, 1);
    expect(rows.recipes.map((r) => r.embedded_at)).toEqual(['stamp']);
    expect(rows.favouriteIds).toEqual(['a']);
    expect(sent).toHaveLength(3);
    expect(sent.some((sql) => sql.includes('embeddings'))).toBe(false);
  });
});
