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
  id: string;
  status: 'COMPLETED';
  created_at: string;
  items: ImportItem[];
}

type Row = typeof recipeImports.$inferSelect;

const toImport = (row: Row): RecipeImport => ({
  id: row.id,
  status: 'COMPLETED',
  created_at: row.created_at,
  items: JSON.parse(row.items) as ImportItem[],
});

/** Store a finished import. */
export async function createRecipeImport(
  db: Database,
  userId: number,
  items: ImportItem[],
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
): Promise<RecipeImport[]> {
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
