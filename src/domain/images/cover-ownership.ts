/**
 * @packageDocumentation
 *
 * Which cover photos a person may ask the proxy for. The proxy fetches
 * pictures from other websites, so left open to any address it would be a free
 * image relay for every signed-in person. Instead it only fetches the photos
 * that their own recipes list in `>> images:`, which is exactly the set the
 * pages ever ask for.
 */

import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { recipes } from '@/domain/db/schema';
import { parseRecipe } from '@/lib/cooklang';
import { extractMedia } from '@/domain/recipe/media';

/**
 * How many recipes that mention the address anywhere are looked at. The text
 * match is only a quick way to narrow down; the real test reads each
 * candidate's image list.
 */
const CANDIDATES = 20;

/** Every photo a recipe lists (the cover first). */
function imagesOf(
  row: Readonly<{ name: string; source: string }>,
): readonly string[] {
  const media = extractMedia(parseRecipe(row.source, row.name));
  return media.cover ? [media.cover, ...media.rest] : [];
}

/**
 * Whether one of the person's recipes lists `url` among its photos. The address
 * has to match the one the recipe stores, character for character, which is how
 * the pages build their requests.
 */
export async function userHasCover(
  db: Database,
  userId: number,
  url: string,
): Promise<boolean> {
  const rows = await db
    .select({ name: recipes.name, source: recipes.source })
    .from(recipes)
    .where(
      and(
        eq(recipes.user_id, userId),
        sql`instr(${recipes.source}, ${url}) > 0`,
      ),
    )
    .limit(CANDIDATES);
  return rows.some((row) => imagesOf(row).includes(url));
}
