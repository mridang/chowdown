/**
 * @packageDocumentation
 *
 * Repository for the `recipes` table — the per-user read cache of the `.cook`
 * files in their Drive folder. Drive stays the source of truth; this cache is
 * what makes the recipe list render instantly and lets the headless MCP answer
 * without a live Drive round-trip. Rows are keyed by the Drive file id and
 * upserted during sync.
 */

import { and, eq } from 'drizzle-orm';

import type { Database } from './client';
import { recipes } from './schema';

/** A full recipe row. */
export type Recipe = typeof recipes.$inferSelect;

function now(): string {
  return new Date().toISOString();
}

/**
 * Insert or update a cached recipe by its Drive file id. On first sight the
 * `first_opened_at`/`last_opened_at` stamps are set; on update only the
 * content-derived fields and `last_opened_at` change.
 */
export async function upsertRecipe(
  db: Database,
  input: {
    user_id: number;
    drive_file_id: string;
    name: string;
    title?: string | null;
    source: string;
    modified_time?: string | null;
    parse_error?: string | null;
  },
): Promise<void> {
  const timestamp = now();
  await db
    .insert(recipes)
    .values({
      user_id: input.user_id,
      drive_file_id: input.drive_file_id,
      name: input.name,
      title: input.title ?? null,
      source: input.source,
      modified_time: input.modified_time ?? null,
      parse_error: input.parse_error ?? null,
      first_opened_at: timestamp,
      last_opened_at: timestamp,
    })
    .onConflictDoUpdate({
      target: recipes.drive_file_id,
      set: {
        name: input.name,
        title: input.title ?? null,
        source: input.source,
        modified_time: input.modified_time ?? null,
        parse_error: input.parse_error ?? null,
        last_opened_at: timestamp,
      },
    });
}

/** All cached recipes for a user, most-recently-modified-looking order by name. */
export async function listRecipesByUser(
  db: Database,
  userId: number,
): Promise<Recipe[]> {
  return db.query.recipes.findMany({
    where: eq(recipes.user_id, userId),
    orderBy: (r, { asc }) => [asc(r.name)],
  });
}

/** Fetch one cached recipe for a user by its Drive file id. */
export async function getRecipeByFileId(
  db: Database,
  userId: number,
  driveFileId: string,
): Promise<Recipe | undefined> {
  return db.query.recipes.findFirst({
    where: and(eq(recipes.user_id, userId), eq(recipes.drive_file_id, driveFileId)),
  });
}
