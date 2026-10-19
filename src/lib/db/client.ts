import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from './schema';

/** A Drizzle client bound to a D1 database, typed against {@link schema}. */
export type Database = DrizzleD1Database<typeof schema> & {
  $client: D1Database;
};

/**
 * Wrap a raw D1 binding in a typed Drizzle client. Repositories take a
 * `D1Database` and call this internally, so their constructors and the
 * test harness stay unchanged.
 *
 * @public
 */
export function createDatabase(d1: D1Database): Database {
  return drizzle(d1, { schema });
}
