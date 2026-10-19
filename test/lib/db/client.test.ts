import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '../../../src/lib/db/client';
import { APP_MIGRATIONS } from './migrations';
import { sqliteD1 } from './sqlite-d1';

describe('createDatabase', () => {
  it('wraps a D1 binding in a client that keeps the binding as $client', () => {
    const { d1 } = sqliteD1();
    expect(createDatabase(d1).$client).toBe(d1);
  });

  it('runs typed queries against the binding', async () => {
    const { d1 } = sqliteD1(...APP_MIGRATIONS);
    const rows = await createDatabase(d1).query.users.findMany();
    expect(rows).toEqual([]);
  });
});
