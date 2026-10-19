/**
 * @packageDocumentation
 *
 * Repository for `recipe_imports`: a user's import requests and the drafts they
 * produced.
 */

import { and, desc, eq } from 'drizzle-orm';

import type { ImportItem } from '../recipe/prepare-import';
import type { Database } from './client';
import { recipeImports } from './schema';

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

/** Store a finished import. */
export async function createRecipeImport(
  db: Database,
  userId: number,
  items: readonly ImportItem[],
): Promise<RecipeImport> {
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    status: 'COMPLETED',
    items: JSON.stringify(items),
    created_at: new Date().toISOString(),
  };
  await db.insert(recipeImports).values(row);
  return toImport(row);
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

/** All of the user's imports, newest first. */
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
