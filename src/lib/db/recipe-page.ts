/**
 * @packageDocumentation
 *
 * Everything the recipe page needs from D1, fetched in **one round trip**.
 *
 * D1 is in a single region, so each query from a Worker running elsewhere pays
 * a long network round trip (~170 ms each in practice). The page used to make
 * three in a row; here the recipe row, the favourite flag, the precomputed
 * similar list, the similar recipes themselves and the user's unit preference go
 * out together as one batch, which D1 runs in a single call.
 */

import { and, count, eq, sql } from 'drizzle-orm';

import type { Database } from '@/core/db/client';
import { embeddings, favourites, recipes, users } from '@/lib/db/schema';

/** What the recipe page reads for one recipe. */
export interface RecipePageRows {
  /** The cached recipe, or `undefined` when it isn't in the cache yet. */
  readonly recipe: typeof recipes.$inferSelect | undefined;
  /** Whether the user has hearted it. */
  readonly favourite: boolean;
  /** The stored similar list as JSON text (parse with `parseSimilar`). */
  readonly similarJson: string | null;
  /** The cached rows of the recipes in that list (unordered). */
  readonly similarRecipes: readonly (typeof recipes.$inferSelect)[];
  /** Which of those similar recipes the user has hearted. */
  readonly similarFavouriteIds: readonly string[];
  /** The user's saved measurement system, or null when they haven't chosen. */
  readonly units: string | null;
  /**
   * The epoch the user's sessions must carry, or undefined when the account is
   * gone. Read in the same round trip so the page can confirm the session is
   * still valid without a query of its own.
   */
  readonly sessionEpoch: number | undefined;
}

/**
 * Fetch the recipe, favourite state, similar list (with the similar recipes'
 * own rows) and the unit preference in a single D1 batch. The similar ids are
 * found with a subquery over the stored JSON list, so no second round trip is
 * needed to learn which rows to load.
 */
export async function getRecipePageRows(
  db: Database,
  userId: number,
  driveFileId: string,
): Promise<RecipePageRows> {
  // The ids in this recipe's stored similar list, as a subquery.
  const similarIds = sql`(select json_extract(j.value, '$.id') from ${embeddings}, json_each(${embeddings.similar}) as j where ${embeddings.user_id} = ${userId} and ${embeddings.drive_file_id} = ${driveFileId})`;
  const [
    recipeRows,
    favouriteRows,
    similarRows,
    similarRecipeRows,
    similarFavouriteRows,
    userRows,
  ] = await db.batch([
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
    db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.user_id, userId),
          sql`${recipes.drive_file_id} in ${similarIds}`,
        ),
      ),
    db
      .select({ id: favourites.drive_file_id })
      .from(favourites)
      .where(
        and(
          eq(favourites.user_id, userId),
          sql`${favourites.drive_file_id} in ${similarIds}`,
        ),
      ),
    db
      .select({ units: users.units, epoch: users.session_epoch })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);
  return {
    recipe: recipeRows[0],
    favourite: favouriteRows.length > 0,
    similarJson: similarRows[0]?.similar ?? null,
    similarRecipes: similarRecipeRows,
    similarFavouriteIds: similarFavouriteRows.map((r) => r.id),
    units: userRows[0]?.units ?? null,
    sessionEpoch: userRows[0]?.epoch,
  };
}

/** What the `/app` grid reads for a user, fetched in one round trip. */
export interface AppPageRows {
  readonly user: typeof users.$inferSelect | undefined;
  readonly recipes: readonly (typeof recipes.$inferSelect)[];
  /** How many recipes have an embedding (a count, not the vectors). */
  readonly embeddedCount: number;
  /** Drive file ids the user has hearted. */
  readonly favouriteIds: readonly string[];
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
