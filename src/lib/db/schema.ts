/**
 * @packageDocumentation
 *
 * The typed database schema — the single source of truth every repository
 * composes queries against. Column names and JS keys are kept identical
 * (snake_case) so query results line up with the row types.
 *
 * The hand-written SQL migrations in `/migrations` remain authoritative;
 * this file mirrors their result so Drizzle can type the queries. Keep it
 * in sync when adding a migration (it matches the live D1 exactly).
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A recipe the user has opened through the app. Cached by its Drive file
 * id so re-opening is instant and recent recipes can be listed without a
 * round-trip to Drive. The viewer itself is client-side and works without
 * this table; it exists for future persistence (history, sharing).
 */
export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  drive_file_id: text('drive_file_id').notNull().unique(),
  name: text('name').notNull(),
  title: text('title'),
  source: text('source').notNull(),
  first_opened_at: text('first_opened_at').notNull(),
  last_opened_at: text('last_opened_at').notNull(),
});
