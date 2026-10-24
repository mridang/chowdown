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

import type { Database } from '@/lib/db/client';
import {
  deleteEmbeddingsNotIn,
  listEmbeddings,
  saveSimilarLists,
  upsertEmbedding,
  type EmbeddingRow,
} from '@/lib/db/embeddings';
import type { User } from '@/lib/db/users';
import { getFileContent, type DriveFile } from '@/lib/drive/drive-client';
import { getDatabase, getEnv } from '@/lib/util/runtime';
import { recipeDisplayName } from '@/lib/recipe/cook-text';
import { parseRecipe } from '@/lib/recipe/cooklang';
import {
  buildEmbeddingText,
  cosineBetween,
  cosineSimilarity,
  embedText,
  measure,
} from '@/lib/recipe/embeddings';
import { mapSequentially } from '@/lib/recipe/map-sequentially';

/** How many "find similar" recipes are stored and shown per recipe. */
export const SIMILAR_COUNT = 6;

/**
 * Bring the stored similar lists up to date after the embeddings of
 * `changedIds` were added or changed (or, with none given, after recipes were
 * removed). Only the lists that can have changed are worked out and only those
 * that did change are written, so a refresh after one saved recipe costs one
 * read of the vectors and a handful of comparisons per recipe, not a
 * comparison of every pair. Call whenever embeddings are added, changed or
 * removed.
 */
export async function refreshSimilarLists(
  db: Database,
  userId: number,
  changedIds: readonly string[] = [],
): Promise<void> {
  const rows = await listEmbeddings(db, userId);
  const lists = updateSimilarLists(rows, changedIds, SIMILAR_COUNT);
  const byId = new Map(rows.map((row) => [row.drive_file_id, row]));
  const changed = new Map(
    [...lists].flatMap(([id, list]) => {
      const next = serializeSimilar(list);
      return next === byId.get(id)?.similar ? [] : [[id, next] as const];
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
  /** Bring the similar lists up to date after these recipes' embeddings changed. */
  readonly refreshLists: (
    db: Database,
    userId: number,
    changedIds: readonly string[],
  ) => Promise<unknown>;
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
    const embeddedIds = files.flatMap((file, i) =>
      outcomes[i] === 'embedded' ? [file.id] : [],
    );
    await deps.refreshLists(db, user.id, embeddedIds);
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

/** A row prepared for comparing: its vector measured once, plus the list stored with it. */
interface Prepared {
  readonly id: string;
  readonly title: string;
  readonly vector: ReturnType<typeof measure>;
  readonly stored: readonly SimilarRecipe[];
}

/** The `n` entries of `candidates` most similar to `a`, best first. */
function nearestTo(
  a: Prepared,
  candidates: readonly Prepared[],
  n: number,
): readonly SimilarRecipe[] {
  return bestOf(
    candidates
      .filter((b) => b.id !== a.id)
      .map((b) => ({
        id: b.id,
        title: b.title,
        score: cosineBetween(a.vector, b.vector),
      })),
    n,
  );
}

/** Whether a row's stored list is shorter than it should be, so was never worked out (or not fully). */
function hasShortList(row: Prepared, rowCount: number, n: number): boolean {
  return row.stored.length < Math.min(n, rowCount - 1);
}

/**
 * Whether a row's stored list can no longer be trusted as "the best `n` of the
 * others" and must be worked out from scratch: the row itself changed, or its
 * list names a recipe that is gone or changed (a changed recipe may no longer
 * rank where it did).
 */
function needsFullRecompute(
  row: Prepared,
  changed: ReadonlySet<string>,
  known: ReadonlySet<string>,
): boolean {
  return (
    changed.has(row.id) ||
    row.stored.some((entry) => !known.has(entry.id) || changed.has(entry.id))
  );
}

/**
 * The similar lists that need to change after the embeddings of `changedIds`
 * were added or changed, as `id -> list` for just the rows that were looked at
 * (the caller writes whichever differ from what is stored). Rows whose stored
 * list is unaffected are left out of the answer.
 *
 * Exact, not approximate: a row that changed, or whose list names a removed
 * or changed recipe, is compared with every other row. Every other row's stored
 * list is still the best `n` of the unchanged rows, so only the changed rows
 * can displace one of its entries, and the new list is the best `n` of its old
 * entries and the changed rows. A row whose list is missing or short has never
 * been worked out (its refresh was lost, or it is new), so it counts as
 * changed too, which keeps the lists healing themselves. Vectors are parsed and
 * measured once. With every id in `changedIds` this is the full all-pairs
 * sweep.
 */
export function updateSimilarLists(
  rows: readonly EmbeddingRow[],
  changedIds: readonly string[],
  n: number,
): ReadonlyMap<string, readonly SimilarRecipe[]> {
  const prepared: readonly Prepared[] = rows.map((r) => ({
    id: r.drive_file_id,
    title: r.title,
    // Measured once here, not once per pair.
    vector: measure(parseVector(r.vector)),
    stored: parseSimilar(r.similar),
  }));
  const known = new Set(prepared.map((p) => p.id));
  const changed = new Set([
    ...changedIds.filter((id) => known.has(id)),
    ...prepared
      .filter((p) => hasShortList(p, prepared.length, n))
      .map((p) => p.id),
  ]);
  const changedRows = prepared.filter((p) => changed.has(p.id));
  const byId = new Map(prepared.map((p) => [p.id, p]));
  return new Map(
    prepared.flatMap((row): [string, readonly SimilarRecipe[]][] => {
      if (needsFullRecompute(row, changed, known)) {
        return [[row.id, nearestTo(row, prepared, n)]];
      }
      if (changedRows.length === 0) {
        return [];
      }
      // Its stored entries are all unchanged rows (checked above): the best
      // `n` of those and the changed rows is the best `n` of everything.
      const kept = row.stored.flatMap((entry) => byId.get(entry.id) ?? []);
      return [[row.id, nearestTo(row, [...kept, ...changedRows], n)]];
    }),
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
