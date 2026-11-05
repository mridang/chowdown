/**
 * @packageDocumentation
 *
 * Which cover photos a person may ask the proxy for. The proxy fetches
 * pictures from other websites, so left open to any address it would be a free
 * image relay for every signed-in person. Instead it only fetches the photos
 * that their own recipes list in `>> images:`, which is exactly the set the
 * pages ever ask for.
 */

import type { Database } from '@/domain/db/client';
import {
  hasIndexedImage,
  indexUnindexedRecipes,
} from '@/domain/db/recipe-images';

/**
 * Whether one of the person's recipes lists `url` among its photos. The address
 * has to match the one the recipe stores, character for character, which is how
 * the pages build their requests.
 *
 * This is a probe of the `recipe_images` index (what each recipe lists, kept in
 * step with the recipe when it is written), not a search through every recipe's
 * text. Recipes written before the table existed are not in it yet: when the
 * address is not found, the person's unindexed recipes are indexed once (a read
 * of an empty partial index in the steady state) and the probe is repeated, so
 * the answer is the same as reading every recipe's text.
 */
export async function userHasCover(
  db: Database,
  userId: number,
  url: string,
): Promise<boolean> {
  if (await hasIndexedImage(db, userId, url)) {
    return true;
  }
  return (await indexUnindexedRecipes(db, userId)) > 0
    ? hasIndexedImage(db, userId, url)
    : false;
}
