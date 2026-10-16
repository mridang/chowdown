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

import { and, eq } from 'drizzle-orm';

import type { Database } from './client';
import { embeddings, favourites, recipes } from './schema';

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
