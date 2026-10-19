import { describe, expect, it } from '@jest/globals';

import {
  createRecipeImport,
  deleteRecipeImport,
  getRecipeImport,
  listRecipeImports,
} from '../../../src/lib/db/recipe-imports';
import type { ImportItem } from '../../../src/lib/recipe/prepare-import';
import { fakeDb } from './fake-db';

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
    };
    expect(stored.user_id).toBe(1);
    expect(JSON.parse(stored.items)).toEqual(items);
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
