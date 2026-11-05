/**
 * @packageDocumentation
 *
 * Repository for `recipe_images` — the photo addresses each cached recipe
 * lists, one row per address, so the image proxy can ask "does this person have
 * a recipe that lists this photo?" with one index lookup instead of searching
 * every recipe's text. The rows are a copy of what is in `recipes.source`,
 * written in the same batch as the recipe and removed with it.
 */

import { and, eq, sql } from 'drizzle-orm';

import { chunked } from '@/domain/db/chunk';
import type { Database } from '@/domain/db/client';
import { recipes, recipeImages } from '@/domain/db/schema';
import { parseRecipe } from '@/lib/cooklang';
import { recipeImageUrls } from '@/domain/recipe/media';

/** Anything `db.batch` accepts. */
type Statement = Parameters<Database['batch']>[0][number];

/**
 * The statements that make a recipe's `recipe_images` rows exactly the photos
 * its text lists: drop its rows, then add one per address (a single statement
 * however many there are, from a JSON array). Run them in the same batch as the
 * write of the recipe row.
 */
export function replaceRecipeImages(
  db: Database,
  userId: number,
  driveFileId: string,
  name: string,
  source: string,
): readonly Statement[] {
  const urls = recipeImageUrls(parseRecipe(source, name));
  return [
    db
      .delete(recipeImages)
      .where(
        and(
          eq(recipeImages.user_id, userId),
          eq(recipeImages.drive_file_id, driveFileId),
        ),
      ),
    ...(urls.length === 0
      ? []
      : [
          db
            .insert(recipeImages)
            .select(
              sql`select ${userId}, ${driveFileId}, value from json_each(${JSON.stringify(urls)}) where true`,
            )
            .onConflictDoNothing(),
        ]),
  ];
}

/** Statements per D1 batch when indexing (well under D1's limit). */
const INDEX_BATCH = 48;

/**
 * Fill in `recipe_images` for the person's recipes that are not indexed yet
 * (rows cached before the table existed, or written by the previous release
 * during a deploy). Returns how many recipes were indexed. In the steady state
 * this is one read of an empty partial index.
 *
 * Each recipe's statements only take effect while it is still unindexed, so a
 * write to the recipe that lands between the read and the batch (and indexes it
 * itself, from newer text) is never overwritten with older addresses.
 */
export async function indexUnindexedRecipes(
  db: Database,
  userId: number,
): Promise<number> {
  const pending = await db
    .select({
      id: recipes.drive_file_id,
      name: recipes.name,
      source: recipes.source,
    })
    .from(recipes)
    // The literal 0 (not a bound value) is what lets the partial index serve this.
    .where(
      and(eq(recipes.user_id, userId), sql`${recipes.images_indexed} = 0`),
    );
  const statements = pending.flatMap((row): Statement[] => {
    const urls = recipeImageUrls(parseRecipe(row.source, row.name));
    // True only while the recipe is still unindexed (see the note above).
    const unindexed = sql`exists (select 1 from recipes where user_id = ${userId} and drive_file_id = ${row.id} and images_indexed = 0)`;
    return [
      db
        .delete(recipeImages)
        .where(
          and(
            eq(recipeImages.user_id, userId),
            eq(recipeImages.drive_file_id, row.id),
            unindexed,
          ),
        ),
      ...(urls.length === 0
        ? []
        : [
            db
              .insert(recipeImages)
              .select(
                sql`select ${userId}, ${row.id}, value from json_each(${JSON.stringify(urls)}) where ${unindexed}`,
              )
              .onConflictDoNothing(),
          ]),
      db
        .update(recipes)
        .set({ images_indexed: 1 })
        .where(
          and(
            eq(recipes.user_id, userId),
            eq(recipes.drive_file_id, row.id),
            sql`${recipes.images_indexed} = 0`,
          ),
        ),
    ];
  });
  for (const [first, ...rest] of chunked(statements, INDEX_BATCH)) {
    // `batch` wants at least one statement; a chunk always has one.
    if (first) {
      await db.batch([first, ...rest]);
    }
  }
  return pending.length;
}

/** Whether one of the person's indexed recipes lists `url` (one covering-index probe). */
export async function hasIndexedImage(
  db: Database,
  userId: number,
  url: string,
): Promise<boolean> {
  const rows = await db
    .select({ one: sql<number>`1` })
    .from(recipeImages)
    .where(and(eq(recipeImages.user_id, userId), eq(recipeImages.url, url)))
    .limit(1);
  return rows.length > 0;
}
