import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * A Drizzle client bound to a D1 database, typed against the schema the caller
 * passes in. The library stays free of any one app's tables: the schema is a
 * type/value parameter, and the app supplies its own (see `domain/db/client`).
 */
export type Database<Schema extends Record<string, unknown>> =
  DrizzleD1Database<Schema> & {
    $client: D1Database;
  };

/**
 * Wrap a raw D1 binding in a typed Drizzle client for `schema`. Code with a
 * request context gets one from the app's `getDatabase()`; code handed a
 * binding (a Workflow, a test) calls this directly with the app's schema.
 *
 * @public
 */
export function createDatabase<Schema extends Record<string, unknown>>(
  d1: D1Database,
  schema: Schema,
): Database<Schema> {
  return drizzle(d1, { schema }) as Database<Schema>;
}
