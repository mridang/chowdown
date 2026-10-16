import { describe, expect, it } from '@jest/globals';

import type { Database } from '../../../src/lib/db/client';
import {
  findRecipeBySourceUrl,
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
