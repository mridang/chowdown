/**
 * @packageDocumentation
 *
 * Shared "similar recipes" orchestration, used by both the MCP server
 * (`find_recipes`, `find_similar`) and the server-rendered `/recipe/[id]` page
 * (the "Find similar" row). It keeps the embedding cache fresh against the
 * user's Drive folder and ranks recipes by cosine similarity in the Worker.
 *
 * The heavy lifting — turning a recipe into an embedding and comparing two
 * vectors — lives in {@link ./embeddings}; this module is the glue that owns
 * the Drive ↔ cache ↔ ranking flow so neither caller has to duplicate it.
 */

import {
  deleteEmbeddingsNotIn,
  listEmbeddings,
  upsertEmbedding,
  type EmbeddingRow,
} from '../db/embeddings';
import type { User } from '../db/users';
import { getFileContent, type DriveFile } from '../drive/drive-client';
import { getDatabase, getEnv } from '../util';
import { recipeDisplayName } from './cook-text';
import { parseRecipe } from './cooklang';
import {
  buildEmbeddingText,
  cosineSimilarity,
  embedText,
} from './embeddings';

/**
 * Ensure every recipe in the folder has a current cached embedding (embedding
 * any that are new or changed), prune stale rows, and return all rows. Lazy:
 * the first call embeds everything, later calls hit the cache and only
 * re-embed files whose Drive `modifiedTime` has moved on.
 */
export async function ensureEmbeddings(
  user: User,
  files: DriveFile[],
  token: string,
): Promise<EmbeddingRow[]> {
  const db = getDatabase();
  const env = getEnv();
  const existing = await listEmbeddings(db, user.id);
  const byId = new Map(existing.map((r) => [r.drive_file_id, r]));
  for (const file of files) {
    const cached = byId.get(file.id);
    if (cached && cached.modified_time === (file.modifiedTime ?? null)) {
      continue;
    }
    const source = await getFileContent(file.id, token);
    const vector = await embedText(
      env,
      buildEmbeddingText(parseRecipe(source, file.name)),
    );
    await upsertEmbedding(db, {
      user_id: user.id,
      drive_file_id: file.id,
      title: recipeDisplayName(file.name),
      modified_time: file.modifiedTime ?? null,
      vector: JSON.stringify(vector),
    });
  }
  await deleteEmbeddingsNotIn(
    db,
    user.id,
    files.map((f) => f.id),
  );
  return listEmbeddings(db, user.id);
}

/** Rank files by cosine similarity to a query vector; return the top `n` files. */
export function topSimilar(
  rows: EmbeddingRow[],
  queryVector: number[],
  files: DriveFile[],
  n: number,
  excludeFileId?: string,
): DriveFile[] {
  const fileById = new Map(files.map((f) => [f.id, f]));
  return rows
    .filter((r) => r.drive_file_id !== excludeFileId)
    .map((r) => ({
      id: r.drive_file_id,
      score: cosineSimilarity(queryVector, JSON.parse(r.vector) as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => fileById.get(s.id))
    .filter((f): f is DriveFile => Boolean(f));
}
