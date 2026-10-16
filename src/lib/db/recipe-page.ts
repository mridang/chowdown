/**
 * @packageDocumentation
 *
 * Everything the recipe page needs from D1, fetched in **one round trip**.
 *
 * D1 is in a single region, so each query from a Worker running elsewhere pays
 * a long network round trip (~170 ms each in practice). The page used to make
 * three in a row; here the recipe row, the favourite flag and the precomputed
 * similar list go out together as one batch, which D1 runs in a single call.
 */

import { and, count, eq } from 'drizzle-orm';

import type { Database } from './client';
import { embeddings, favourites, recipes, users } from './schema';

/** What the recipe page reads for one recipe. */
export interface RecipePageRows {
  /** The cached recipe, or `undefined` when it isn't in the cache yet. */
  recipe: typeof recipes.$inferSelect | undefined;
  /** Whether the user has hearted it. */
  favourite: boolean;
  /** The stored similar list as JSON text (parse with `parseSimilar`). */
  similarJson: string | null;
}

/** Fetch the recipe, favourite state and similar list in a single D1 batch. */
export async function getRecipePageRows(
  db: Database,
  userId: number,
  driveFileId: string,
): Promise<RecipePageRows> {
  const [recipeRows, favouriteRows, similarRows] = await db.batch([
    db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.user_id, userId),
          eq(recipes.drive_file_id, driveFileId),
        ),
      )
      .limit(1),
    db
      .select({ id: favourites.drive_file_id })
      .from(favourites)
      .where(
        and(
          eq(favourites.user_id, userId),
          eq(favourites.drive_file_id, driveFileId),
        ),
      )
      .limit(1),
    db
      .select({ similar: embeddings.similar })
      .from(embeddings)
      .where(
        and(
          eq(embeddings.user_id, userId),
          eq(embeddings.drive_file_id, driveFileId),
        ),
      )
      .limit(1),
  ]);
  return {
    recipe: recipeRows[0],
    favourite: favouriteRows.length > 0,
    similarJson: similarRows[0]?.similar ?? null,
  };
}

/** What the `/app` grid reads for a user, fetched in one round trip. */
export interface AppPageRows {
  user: typeof users.$inferSelect | undefined;
  recipes: (typeof recipes.$inferSelect)[];
  /** How many recipes have an embedding (a count, not the vectors). */
  embeddedCount: number;
  /** Drive file ids the user has hearted. */
  favouriteIds: string[];
}

/**
 * The user row, their cached recipes and their embedding count in one D1 batch
 * — the whole `/app` grid in a single round trip, with no Google or Drive call.
 */
export async function getAppPageRows(
  db: Database,
  userId: number,
): Promise<AppPageRows> {
  const [userRows, recipeRows, countRows, favouriteRows] = await db.batch([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select()
      .from(recipes)
      .where(eq(recipes.user_id, userId))
      .orderBy(recipes.name),
    db
      .select({ n: count() })
      .from(embeddings)
      .where(eq(embeddings.user_id, userId)),
    db
      .select({ id: favourites.drive_file_id })
      .from(favourites)
      .where(eq(favourites.user_id, userId)),
  ]);
  return {
    user: userRows[0],
    recipes: recipeRows,
    embeddedCount: countRows[0]?.n ?? 0,
    favouriteIds: favouriteRows.map((r) => r.id),
  };
}
