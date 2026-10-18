import { describe, expect, it } from '@jest/globals';

import type { Database } from '../../../src/lib/db/client';
import {
  deleteRecipeData,
  findRecipeBySourceUrl,
  staleRecipeIds,
  type Recipe,
} from '../../../src/lib/db/recipes';

/** A stub database whose recipes query returns the given rows. */
function dbWith(rows: Partial<Recipe>[]): Database {
  return {
    query: { recipes: { findMany: async () => rows } },
  } as unknown as Database;
}

const rows: Partial<Recipe>[] = [
  {
    drive_file_id: 'a',
    name: 'A.cook',
    source: '>> title: A\n>> source: https://www.site.com/post/a/?utm=1\n',
  },
  { drive_file_id: 'b', name: 'B.cook', source: '>> title: B\n' },
];

describe('findRecipeBySourceUrl', () => {
  it('matches the same page despite www, query and trailing slash', async () => {
    const hit = await findRecipeBySourceUrl(
      dbWith(rows),
      1,
      'http://site.com/post/a',
    );
    expect(hit?.drive_file_id).toBe('a');
  });

  it('returns undefined for a link not yet imported', async () => {
    expect(
      await findRecipeBySourceUrl(
        dbWith(rows),
        1,
        'https://site.com/post/other',
      ),
    ).toBeUndefined();
  });

  it('ignores recipes with no source line', async () => {
    expect(
      await findRecipeBySourceUrl(
        dbWith([rows[1]!]),
        1,
        'https://site.com/post/a',
      ),
    ).toBeUndefined();
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
