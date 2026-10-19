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
import {
  buildEmbeddingText,
  cosineBetween,
  cosineSimilarity,
  embedText,
  measure,
} from './embeddings';
import { mapSequentially } from './map-sequentially';

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
  const changed = new Map(
    rows.flatMap((row) => {
      const next = serializeSimilar(lists.get(row.drive_file_id) ?? []);
      return next === row.similar ? [] : [[row.drive_file_id, next] as const];
    }),
  );
  if (changed.size > 0) {
    await saveSimilarLists(db, userId, changed);
  }
}

/**
 * Everything {@link ensureEmbeddings} reaches out to, gathered in one place so a
 * test can hand in small fakes. The default is the real database, Drive and
 * Workers AI.
 */
export interface EmbeddingDeps {
  /** The D1 database the embeddings live in. */
  readonly database: () => Database;
  /** The Worker environment (for the AI binding). */
  readonly env: () => CloudflareEnv;
  /** The user's cached embeddings. */
  readonly listCached: (
    db: Database,
    userId: number,
  ) => Promise<readonly EmbeddingRow[]>;
  /** Store (or update) one embedding. */
  readonly save: (
    db: Database,
    row: Parameters<typeof upsertEmbedding>[1],
  ) => Promise<unknown>;
  /** Drop embeddings for files that are no longer in `keep`. */
  readonly prune: (
    db: Database,
    userId: number,
    keep: readonly string[],
  ) => Promise<unknown>;
  /** Download a file's text from Drive. */
  readonly readFile: (fileId: string, token: string) => Promise<string>;
  /** Turn text into an embedding vector. */
  readonly embed: (
    env: CloudflareEnv,
    text: string,
  ) => Promise<readonly number[]>;
  /** Recompute and store the similar lists. */
  readonly refreshLists: (db: Database, userId: number) => Promise<unknown>;
}

/** The real thing: D1, Drive and Workers AI. */
const liveEmbeddingDeps: EmbeddingDeps = {
  database: getDatabase,
  env: getEnv,
  listCached: listEmbeddings,
  save: upsertEmbedding,
  prune: deleteEmbeddingsNotIn,
  readFile: getFileContent,
  embed: embedText,
  refreshLists: refreshSimilarLists,
};

/** What bringing one file's cached embedding up to date involved. */
type EmbeddingOutcome = 'current' | 'adopted-timestamp' | 'embedded';

/**
 * Bring one file's cached embedding up to date: nothing when it already is,
 * adopt Drive's timestamp when the vector was made at write time, otherwise
 * read the file and embed it afresh.
 */
async function refreshEmbedding(
  deps: EmbeddingDeps,
  db: Database,
  userId: number,
  token: string,
  file: DriveFile,
  cached: EmbeddingRow | undefined,
): Promise<EmbeddingOutcome> {
  if (cached && cached.modified_time === (file.modifiedTime ?? null)) {
    return 'current';
  }
  if (cached && cached.modified_time === null && file.modifiedTime) {
    // Embedded at write time, before Drive's timestamp was known: the vector
    // is current, so adopt the timestamp instead of re-embedding.
    await deps.save(db, {
      user_id: userId,
      drive_file_id: file.id,
      title: cached.title,
      modified_time: file.modifiedTime,
      vector: cached.vector,
    });
    return 'adopted-timestamp';
  }
  const source = await deps.readFile(file.id, token);
  const vector = await deps.embed(
    deps.env(),
    buildEmbeddingText(parseRecipe(source, file.name)),
  );
  await deps.save(db, {
    user_id: userId,
    drive_file_id: file.id,
    title: recipeDisplayName(file.name),
    modified_time: file.modifiedTime ?? null,
    vector: JSON.stringify(vector),
  });
  return 'embedded';
}

/**
 * Ensure every recipe in the folder has a current cached embedding (embedding
 * any that are new or changed), prune stale rows, and return all rows. Lazy:
 * the first call embeds everything, later calls hit the cache and only
 * re-embed files whose Drive `modifiedTime` has moved on.
 *
 * @param deps Collaborators; leave out to use the real database, Drive and AI.
 */
export async function ensureEmbeddings(
  user: Readonly<User>,
  files: readonly DriveFile[],
  token: string,
  deps: EmbeddingDeps = liveEmbeddingDeps,
): Promise<readonly EmbeddingRow[]> {
  const db = deps.database();
  const existing = await deps.listCached(db, user.id);
  const byId = new Map(existing.map((r) => [r.drive_file_id, r]));
  // One file at a time: each may call Workers AI, which has tight limits.
  const outcomes = await mapSequentially(files, (file) =>
    refreshEmbedding(deps, db, user.id, token, file, byId.get(file.id)),
  );
  const fileIds = new Set(files.map((f) => f.id));
  const stale = existing.some((r) => !fileIds.has(r.drive_file_id));
  await deps.prune(
    db,
    user.id,
    files.map((f) => f.id),
  );
  if (outcomes.includes('embedded') || stale) {
    await deps.refreshLists(db, user.id);
  }
  return deps.listCached(db, user.id);
}

/** A similar recipe, resolved purely from the embedding cache (no Drive). */
export interface SimilarRecipe {
  readonly id: string;
  readonly title: string;
}

/**
 * Read a stored vector back from its JSON text. Anything that isn't a list of
 * numbers reads as an empty vector (which is similar to nothing).
 */
export function parseVector(json: string): readonly number[] {
  const value: unknown = JSON.parse(json);
  return Array.isArray(value)
    ? value.filter((x): x is number => typeof x === 'number')
    : [];
}

/**
 * The `n` best-scoring entries, best first, as `{ id, title }`. Sorting is
 * stable, so ties keep the order they came in.
 */
function bestOf(
  scored: readonly (SimilarRecipe & { readonly score: number })[],
  n: number,
): readonly SimilarRecipe[] {
  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ id, title }) => ({ id, title }));
}

/**
 * Rank cached embeddings by cosine similarity to one recipe's own embedding,
 * entirely from D1 — no Drive and no model call, so the recipe page stays fast.
 * Returns `[]` when the seed recipe has no cached embedding yet (it appears once
 * the embeddings are built by a search/suggest pass).
 */
export function similarFromRows(
  rows: readonly EmbeddingRow[],
  selfId: string,
  n: number,
): readonly SimilarRecipe[] {
  const self = rows.find((r) => r.drive_file_id === selfId);
  if (!self) {
    return [];
  }
  const selfVector = parseVector(self.vector);
  return bestOf(
    rows
      .filter((r) => r.drive_file_id !== selfId)
      .map((r) => ({
        id: r.drive_file_id,
        title: r.title,
        score: cosineSimilarity(selfVector, parseVector(r.vector)),
      })),
    n,
  );
}

/**
 * Compute every recipe's nearest neighbours in one pass: for each row, the `n`
 * most similar *other* rows, best first. Vectors are parsed once, so this is a
 * single O(rows²) sweep — cheap at per-user recipe counts — and its result is
 * stored on the rows (see {@link serializeSimilar}) so page views never repeat
 * it.
 */
export function computeSimilarLists(
  rows: readonly EmbeddingRow[],
  n: number,
): ReadonlyMap<string, readonly SimilarRecipe[]> {
  const parsed = rows.map((r) => ({
    id: r.drive_file_id,
    title: r.title,
    // Measured once here, not once per pair: the sweep below compares every
    // vector with every other.
    vector: measure(parseVector(r.vector)),
  }));
  return new Map(
    parsed.map((a) => [
      a.id,
      bestOf(
        parsed
          .filter((b) => b.id !== a.id)
          .map((b) => ({
            id: b.id,
            title: b.title,
            score: cosineBetween(a.vector, b.vector),
          })),
        n,
      ),
    ]),
  );
}

/** Serialise a similar list for the `embeddings.similar` column. */
export function serializeSimilar(list: readonly SimilarRecipe[]): string {
  return JSON.stringify(list);
}

/** Whether a parsed JSON value looks like a {@link SimilarRecipe}. */
function isSimilarRecipe(value: unknown): value is SimilarRecipe {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

/**
 * Read a stored similar list back. Tolerates a missing value or malformed JSON
 * (returns `[]`) so a bad row can never break a recipe page.
 */
export function parseSimilar(
  json: string | null | undefined,
): readonly SimilarRecipe[] {
  if (!json) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter(isSimilarRecipe) : [];
  } catch {
    return [];
  }
}

/**
 * Rank files by cosine similarity to a query vector; return the top `n` files.
 * Only rows whose file is still in `files` compete, so a stale row for a file
 * that has gone cannot take one of the `n` places.
 */
export function topSimilar(
  rows: readonly EmbeddingRow[],
  queryVector: readonly number[],
  files: readonly DriveFile[],
  n: number,
  excludeFileId?: string,
): readonly DriveFile[] {
  const fileById = new Map(files.map((f) => [f.id, f]));
  return rows
    .filter((r) => r.drive_file_id !== excludeFileId)
    .flatMap((r) => {
      const file = fileById.get(r.drive_file_id);
      return file
        ? [
            {
              file,
              score: cosineSimilarity(queryVector, parseVector(r.vector)),
            },
          ]
        : [];
    })
    .toSorted((a, b) => b.score - a.score)
    .slice(0, n)
    .map((ranked) => ranked.file);
}
