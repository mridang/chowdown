/**
 * @packageDocumentation
 *
 * Keep recipe embeddings current without making anyone wait. A recipe is
 * embedded in the background right after it is written (create, import, tag,
 * note…), and a bounded backfill embeds any recipe that has none yet. Both end
 * by updating the stored similar lists, which is what makes the recipe page's
 * "Find similar" row a single cheap read.
 */

import type { Database } from '@/core/db/client';
import { listEmbeddings, upsertEmbedding } from '@/lib/db/embeddings';
import { listRecipesByUser } from '@/lib/db/recipes';
import { recipeDisplayName } from '@/lib/cooklang/cook-text';
import { parseRecipe } from '@/lib/cooklang/cooklang';
import { buildEmbeddingText, embedText } from '@/lib/recipe/embeddings';
import { mapSequentially } from '@/lib/async/map-sequentially';
import { refreshSimilarLists } from '@/lib/recipe/similar';

/**
 * What embedding reaches out to, gathered in one place so a test can hand in
 * small fakes. The default is the real database and Workers AI.
 */
export interface EmbedWriteDeps {
  /** The user's cached recipes. */
  readonly listRecipes: (
    db: Database,
    userId: number,
  ) => Promise<
    readonly {
      readonly drive_file_id: string;
      readonly name: string;
      readonly source: string;
      readonly modified_time: string | null;
      readonly parse_error?: unknown;
    }[]
  >;
  /** The user's cached embeddings. */
  readonly listEmbeddings: (
    db: Database,
    userId: number,
  ) => Promise<readonly { readonly drive_file_id: string }[]>;
  /** Store (or update) one embedding. */
  readonly save: (
    db: Database,
    row: Parameters<typeof upsertEmbedding>[1],
  ) => Promise<unknown>;
  /** Turn text into an embedding vector. */
  readonly embed: (
    env: CloudflareEnv,
    text: string,
  ) => Promise<readonly number[]>;
  /** Bring the similar lists up to date after these recipes' embeddings changed. */
  readonly refreshLists: (
    db: Database,
    userId: number,
    changedIds: readonly string[],
  ) => Promise<unknown>;
}

/** The real thing. */
const liveDeps: EmbedWriteDeps = {
  listRecipes: listRecipesByUser,
  listEmbeddings,
  save: upsertEmbedding,
  embed: embedText,
  refreshLists: refreshSimilarLists,
};

/** Embed one recipe's source and store the vector (no similar-list refresh). */
async function embedAndStore(
  deps: EmbedWriteDeps,
  db: Database,
  env: CloudflareEnv,
  userId: number,
  driveFileId: string,
  name: string,
  source: string,
  modifiedTime: string | null,
): Promise<void> {
  const vector = await deps.embed(
    env,
    buildEmbeddingText(parseRecipe(source, name)),
  );
  await deps.save(db, {
    user_id: userId,
    drive_file_id: driveFileId,
    title: recipeDisplayName(name),
    modified_time: modifiedTime,
    vector: JSON.stringify(vector),
  });
}

/**
 * Embed a just-written recipe and update the similar lists it affects.
 *
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function embedRecipe(
  db: Database,
  env: CloudflareEnv,
  userId: number,
  driveFileId: string,
  name: string,
  source: string,
  modifiedTime: string | null = null,
  deps: EmbedWriteDeps = liveDeps,
): Promise<void> {
  await embedAndStore(
    deps,
    db,
    env,
    userId,
    driveFileId,
    name,
    source,
    modifiedTime,
  );
  await deps.refreshLists(db, userId, [driveFileId]);
}

/**
 * Embed up to `limit` cached recipes that have no embedding yet, then refresh
 * the similar lists. Bounded so one request stays within the Worker's limits;
 * call it again to continue. Returns how many were embedded.
 *
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function backfillEmbeddings(
  db: Database,
  env: CloudflareEnv,
  userId: number,
  limit = 20,
  deps: EmbedWriteDeps = liveDeps,
): Promise<number> {
  const [recipes, embedded] = await Promise.all([
    deps.listRecipes(db, userId),
    deps.listEmbeddings(db, userId),
  ]);
  const have = new Set(embedded.map((e) => e.drive_file_id));
  const missing = recipes
    .filter((r) => !have.has(r.drive_file_id) && !r.parse_error)
    .slice(0, limit);
  // One at a time: each calls Workers AI, which has tight concurrency limits.
  await mapSequentially(missing, (r) =>
    embedAndStore(
      deps,
      db,
      env,
      userId,
      r.drive_file_id,
      r.name,
      r.source,
      r.modified_time,
    ),
  );
  if (missing.length > 0) {
    await deps.refreshLists(
      db,
      userId,
      missing.map((r) => r.drive_file_id),
    );
  }
  return missing.length;
}
