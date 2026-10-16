/**
 * @packageDocumentation
 *
 * Keep recipe embeddings current without making anyone wait. A recipe is
 * embedded in the background right after it is written (create, import, tag,
 * note…), and a bounded backfill embeds any recipe that has none yet. Both end
 * by refreshing the stored similar lists, which is what makes the recipe page's
 * "Find similar" row a single cheap read.
 */

import type { Database } from '../db/client';
import { listEmbeddings, upsertEmbedding } from '../db/embeddings';
import { listRecipesByUser } from '../db/recipes';
import { recipeDisplayName } from './cook-text';
import { parseRecipe } from './cooklang';
import { buildEmbeddingText, embedText } from './embeddings';
import { refreshSimilarLists } from './similar';

/** Embed one recipe's source and store the vector (no similar-list refresh). */
async function embedAndStore(
  db: Database,
  env: CloudflareEnv,
  userId: number,
  driveFileId: string,
  name: string,
  source: string,
  modifiedTime: string | null,
): Promise<void> {
  const vector = await embedText(
    env,
    buildEmbeddingText(parseRecipe(source, name)),
  );
  await upsertEmbedding(db, {
    user_id: userId,
    drive_file_id: driveFileId,
    title: recipeDisplayName(name),
    modified_time: modifiedTime,
    vector: JSON.stringify(vector),
  });
}

/** Embed a just-written recipe and refresh everyone's similar lists. */
export async function embedRecipe(
  db: Database,
  env: CloudflareEnv,
  userId: number,
  driveFileId: string,
  name: string,
  source: string,
  modifiedTime: string | null = null,
): Promise<void> {
  await embedAndStore(db, env, userId, driveFileId, name, source, modifiedTime);
  await refreshSimilarLists(db, userId);
}

/**
 * Embed up to `limit` cached recipes that have no embedding yet, then refresh
 * the similar lists. Bounded so one request stays within the Worker's limits;
 * call it again to continue. Returns how many were embedded.
 */
export async function backfillEmbeddings(
  db: Database,
  env: CloudflareEnv,
  userId: number,
  limit = 20,
): Promise<number> {
  const [recipes, embedded] = await Promise.all([
    listRecipesByUser(db, userId),
    listEmbeddings(db, userId),
  ]);
  const have = new Set(embedded.map((e) => e.drive_file_id));
  const missing = recipes
    .filter((r) => !have.has(r.drive_file_id) && !r.parse_error)
    .slice(0, limit);
  for (const r of missing) {
    await embedAndStore(
      db,
      env,
      userId,
      r.drive_file_id,
      r.name,
      r.source,
      r.modified_time,
    );
  }
  if (missing.length > 0) {
    await refreshSimilarLists(db, userId);
  }
  return missing.length;
}
