import { describe, expect, it } from '@jest/globals';

import type { Database } from '../../../src/lib/db/client';
import { getRecipePageRows } from '../../../src/lib/db/recipe-page';

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
      [{ units: 'metric' }],
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
    });
  });

  it('copes with a recipe that has no favourite, similar list or user row', async () => {
    const stub = dbReturning([[], [], [], [], [], []]);
    const rows = await getRecipePageRows(stub.db, 1, 'gone');
    expect(rows).toEqual({
      recipe: undefined,
      favourite: false,
      similarJson: null,
      similarRecipes: [],
      similarFavouriteIds: [],
      units: null,
    });
  });
});
