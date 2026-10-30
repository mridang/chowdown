/**
 * @packageDocumentation
 *
 * Repository for `recipe_imports`: a user's import requests and the drafts they
 * produced.
 */

import { and, desc, eq, lt, or, sql } from 'drizzle-orm';

import type { ImportItem } from '@/domain/recipe/prepare-import';
import type { Database } from '@/domain/db/client';
import { recipeImports } from '@/domain/db/schema';

/** An import as stored. */
export interface RecipeImport {
  readonly id: string;
  readonly status: 'COMPLETED';
  readonly created_at: string;
  readonly items: readonly ImportItem[];
}

/** A row of the `recipe_imports` table. */
type Row = typeof recipeImports.$inferSelect;

/** The drafts stored in a row's `items` column (written by {@link createRecipeImport}). */
function itemsOf(json: string): readonly ImportItem[] {
  const parsed: unknown = JSON.parse(json);
  return Array.isArray(parsed) ? parsed : [];
}

/** The import a stored row stands for. */
function toImport(row: Readonly<Row>): RecipeImport {
  return {
    id: row.id,
    status: 'COMPLETED',
    created_at: row.created_at,
    items: itemsOf(row.items),
  };
}

/** How long a draft import is kept, in days. Drafts are throwaway: a person reviews them within minutes. */
export const IMPORT_RETENTION_DAYS = 7;

/** The most imports one person keeps; saving another drops the oldest. */
export const MAX_IMPORTS_PER_USER = 20;

/** The moment before which a draft import has outlived its retention. */
function retentionCutoff(now: Date): string {
  return new Date(
    now.getTime() - IMPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Delete the user's imports that are older than the retention period or
 * beyond the newest {@link MAX_IMPORTS_PER_USER}. A statement, not a call, so
 * it can ride along in the same batch as the insert that makes it necessary.
 */
function pruneStatement(db: Database, userId: number, now: Date) {
  const cutoff = retentionCutoff(now);
  return db
    .delete(recipeImports)
    .where(
      and(
        eq(recipeImports.user_id, userId),
        or(
          lt(recipeImports.created_at, cutoff),
          sql`${recipeImports.id} not in (select ${recipeImports.id} from ${recipeImports} where ${recipeImports.user_id} = ${userId} order by ${recipeImports.created_at} desc limit ${MAX_IMPORTS_PER_USER})`,
        ),
      ),
    );
}

/**
 * Store a finished import, and in the same round trip drop the person's
 * expired and surplus imports (see {@link IMPORT_RETENTION_DAYS} and
 * {@link MAX_IMPORTS_PER_USER}), so storage per person stays bounded without a
 * scheduled job.
 */
export async function createRecipeImport(
  db: Database,
  userId: number,
  items: readonly ImportItem[],
): Promise<RecipeImport> {
  const created = new Date();
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    status: 'COMPLETED',
    items: JSON.stringify(items),
    item_count: items.length,
    created_at: created.toISOString(),
  };
  await db.batch([
    db.insert(recipeImports).values(row),
    pruneStatement(db, userId, created),
  ]);
  return toImport(row);
}

/**
 * Delete every person's imports older than the retention period. For the
 * scheduled housekeeping sweep: it also reaches people who have stopped
 * importing, whose leftovers {@link createRecipeImport} never gets to prune.
 * Returns how many were deleted.
 */
export async function purgeExpiredRecipeImports(
  db: Database,
  now: Date = new Date(),
): Promise<number> {
  const result = await db
    .delete(recipeImports)
    .where(lt(recipeImports.created_at, retentionCutoff(now)))
    .run();
  return result.meta.changes ?? 0;
}

/** One of the user's imports. */
export async function getRecipeImport(
  db: Database,
  userId: number,
  id: string,
): Promise<RecipeImport | undefined> {
  const row = await db.query.recipeImports.findFirst({
    where: and(eq(recipeImports.user_id, userId), eq(recipeImports.id, id)),
  });
  return row ? toImport(row) : undefined;
}

/** All of the user's imports, newest first, with their drafts. */
export async function listRecipeImports(
  db: Database,
  userId: number,
): Promise<readonly RecipeImport[]> {
  const rows = await db
    .select()
    .from(recipeImports)
    .where(eq(recipeImports.user_id, userId))
    .orderBy(desc(recipeImports.created_at));
  return rows.map(toImport);
}

/** An import as a list shows it: no drafts, just how many there are. */
export interface RecipeImportListing {
  readonly id: string;
  readonly status: 'COMPLETED';
  readonly created_at: string;
  readonly item_count: number;
}

/**
 * The user's imports, newest first, without their drafts. The count comes from
 * the stored `item_count` (or, for an import saved before that column
 * existed, is counted in the database), so listing never carries every draft's
 * text across the wire.
 */
export async function listRecipeImportSummaries(
  db: Database,
  userId: number,
): Promise<readonly RecipeImportListing[]> {
  const rows = await db
    .select({
      id: recipeImports.id,
      created_at: recipeImports.created_at,
      item_count: sql<number>`coalesce(${recipeImports.item_count}, case when json_valid(${recipeImports.items}) then json_array_length(${recipeImports.items}) else 0 end)`,
    })
    .from(recipeImports)
    .where(eq(recipeImports.user_id, userId))
    .orderBy(desc(recipeImports.created_at));
  return rows.map((row): RecipeImportListing => ({
    ...row,
    status: 'COMPLETED',
  }));
}

/** Delete one of the user's imports. Returns false if there was no such import. */
export async function deleteRecipeImport(
  db: Database,
  userId: number,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(recipeImports)
    .where(and(eq(recipeImports.user_id, userId), eq(recipeImports.id, id)))
    .run();
  return (result.meta.changes ?? 0) > 0;
}
