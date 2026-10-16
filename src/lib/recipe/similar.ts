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

import type { Database } from '../db/client';
import {
  deleteEmbeddingsNotIn,
  listEmbeddings,
  saveSimilarLists,
  upsertEmbedding,
  type EmbeddingRow,
} from '../db/embeddings';
import type { User } from '../db/users';
import { getFileContent, type DriveFile } from '../drive/drive-client';
import { getDatabase, getEnv } from '../util';
import { recipeDisplayName } from './cook-text';
import { parseRecipe } from './cooklang';
import { buildEmbeddingText, cosineSimilarity, embedText } from './embeddings';

/** How many "find similar" recipes are stored and shown per recipe. */
export const SIMILAR_COUNT = 6;

/**
 * Recompute and store every recipe's similar list for a user. Only rows whose
 * list actually changed are written, so a no-op refresh costs a single read.
 * Call whenever embeddings are added, changed or removed.
 */
export async function refreshSimilarLists(
  db: Database,
  userId: number,
): Promise<void> {
  const rows = await listEmbeddings(db, userId);
  const lists = computeSimilarLists(rows, SIMILAR_COUNT);
  const changed = new Map<string, string>();
  for (const row of rows) {
    const next = serializeSimilar(lists.get(row.drive_file_id) ?? []);
    if (next !== row.similar) {
      changed.set(row.drive_file_id, next);
    }
  }
  if (changed.size > 0) {
    await saveSimilarLists(db, userId, changed);
  }
}

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
  let changed = false;
  for (const file of files) {
    const cached = byId.get(file.id);
    if (cached && cached.modified_time === (file.modifiedTime ?? null)) {
      continue;
    }
    if (cached && cached.modified_time === null && file.modifiedTime) {
      // Embedded at write time, before Drive's timestamp was known: the vector
      // is current, so adopt the timestamp instead of re-embedding.
      await upsertEmbedding(db, {
        user_id: user.id,
        drive_file_id: file.id,
        title: cached.title,
        modified_time: file.modifiedTime,
        vector: cached.vector,
      });
      continue;
    }
    changed = true;
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
  const stale = existing.some(
    (r) => !files.some((f) => f.id === r.drive_file_id),
  );
  await deleteEmbeddingsNotIn(
    db,
    user.id,
    files.map((f) => f.id),
  );
  if (changed || stale) {
    await refreshSimilarLists(db, user.id);
  }
  return listEmbeddings(db, user.id);
}

/** A similar recipe, resolved purely from the embedding cache (no Drive). */
export interface SimilarRecipe {
  id: string;
  title: string;
}

/**
 * Rank cached embeddings by cosine similarity to one recipe's own embedding,
 * entirely from D1 — no Drive and no model call, so the recipe page stays fast.
 * Returns `[]` when the seed recipe has no cached embedding yet (it appears once
 * the embeddings are built by a search/suggest pass).
 */
export function similarFromRows(
  rows: EmbeddingRow[],
  selfId: string,
  n: number,
): SimilarRecipe[] {
  const self = rows.find((r) => r.drive_file_id === selfId);
  if (!self) {
    return [];
  }
  const selfVector = JSON.parse(self.vector) as number[];
  return rows
    .filter((r) => r.drive_file_id !== selfId)
    .map((r) => ({
      id: r.drive_file_id,
      title: r.title,
      score: cosineSimilarity(selfVector, JSON.parse(r.vector) as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ id, title }) => ({ id, title }));
}

/**
 * Compute every recipe's nearest neighbours in one pass: for each row, the `n`
 * most similar *other* rows, best first. Vectors are parsed once, so this is a
 * single O(rows²) sweep — cheap at per-user recipe counts — and its result is
 * stored on the rows (see {@link serializeSimilar}) so page views never repeat
 * it.
 */
export function computeSimilarLists(
  rows: EmbeddingRow[],
  n: number,
): Map<string, SimilarRecipe[]> {
  const parsed = rows.map((r) => ({
    id: r.drive_file_id,
    title: r.title,
    vector: JSON.parse(r.vector) as number[],
  }));
  const lists = new Map<string, SimilarRecipe[]>();
  for (const a of parsed) {
    const ranked = parsed
      .filter((b) => b.id !== a.id)
      .map((b) => ({
        id: b.id,
        title: b.title,
        score: cosineSimilarity(a.vector, b.vector),
      }))
      .sort((x, y) => y.score - x.score)
      .slice(0, n)
      .map(({ id, title }) => ({ id, title }));
    lists.set(a.id, ranked);
  }
  return lists;
}

/** Serialise a similar list for the `embeddings.similar` column. */
export function serializeSimilar(list: SimilarRecipe[]): string {
  return JSON.stringify(list);
}

/**
 * Read a stored similar list back. Tolerates a missing value or malformed JSON
 * (returns `[]`) so a bad row can never break a recipe page.
 */
export function parseSimilar(json: string | null | undefined): SimilarRecipe[] {
  if (!json) {
    return [];
  }
  try {
    const value = JSON.parse(json) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (v): v is SimilarRecipe =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as SimilarRecipe).id === 'string' &&
        typeof (v as SimilarRecipe).title === 'string',
    );
  } catch {
    return [];
  }
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
