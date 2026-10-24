/**
 * @packageDocumentation
 *
 * Repository for the `embeddings` cache — one vector per recipe, keyed by the
 * Drive file id and stamped with the file's `modified_time` so a recipe is only
 * re-embedded when it actually changes.
 */

import { and, count, eq, inArray, sql } from 'drizzle-orm';

import { chunked } from '@/domain/db/chunk';
import type { Database } from '@/core/db/client';
import { embeddings, recipes } from '@/domain/db/schema';

/** A cached embedding row. */
export type EmbeddingRow = typeof embeddings.$inferSelect;

/** All cached embeddings for a user. */
export async function listEmbeddings(
  db: Database,
  userId: number,
): Promise<readonly EmbeddingRow[]> {
  return db.query.embeddings.findMany({
    where: eq(embeddings.user_id, userId),
  });
}

/** Insert or update a recipe's cached embedding. */
export async function upsertEmbedding(
  db: Database,
  input: Readonly<{
    user_id: number;
    drive_file_id: string;
    title: string;
    modified_time: string | null;
    vector: string;
  }>,
): Promise<void> {
  await db
    .insert(embeddings)
    .values(input)
    .onConflictDoUpdate({
      target: [embeddings.user_id, embeddings.drive_file_id],
      set: {
        title: input.title,
        modified_time: input.modified_time,
        vector: input.vector,
      },
    });
}

/**
 * Drop cached embeddings for files that no longer exist in the folder. Works
 * out what to drop here and deletes it a few ids at a time, since D1 limits the
 * parameters in a statement.
 */
export async function deleteEmbeddingsNotIn(
  db: Database,
  userId: number,
  keepFileIds: readonly string[],
): Promise<void> {
  const keep = new Set(keepFileIds);
  const cached = await db
    .select({ id: embeddings.drive_file_id })
    .from(embeddings)
    .where(eq(embeddings.user_id, userId));
  const stale = cached.map((row) => row.id).filter((id) => !keep.has(id));
  for (const ids of chunked(stale)) {
    await db
      .delete(embeddings)
      .where(
        and(
          eq(embeddings.user_id, userId),
          inArray(embeddings.drive_file_id, ids),
        ),
      );
  }
}

/**
 * Drop cached embeddings whose recipe is no longer cached. Safe to run beside a
 * save: a recipe written during a sync has its row (and so keeps its
 * embedding), whatever the folder listing taken earlier said.
 */
export async function deleteOrphanEmbeddings(
  db: Database,
  userId: number,
): Promise<void> {
  await db
    .delete(embeddings)
    .where(
      and(
        eq(embeddings.user_id, userId),
        sql`${embeddings.drive_file_id} not in (select ${recipes.drive_file_id} from ${recipes} where ${recipes.user_id} = ${userId})`,
      ),
    );
}

/** Max statements per D1 batch (kept well under D1's per-batch limit). */
const BATCH_SIZE = 50;

/**
 * Store each recipe's precomputed similar list (`id → serialised JSON`). Only
 * the rows passed in are touched; they are written in batches so a refresh is a
 * handful of round trips, not one per recipe.
 */
export async function saveSimilarLists(
  db: Database,
  userId: number,
  lists: ReadonlyMap<string, string>,
): Promise<void> {
  const statements = [...lists].map(([driveFileId, json]) =>
    db
      .update(embeddings)
      .set({ similar: json })
      .where(
        and(
          eq(embeddings.user_id, userId),
          eq(embeddings.drive_file_id, driveFileId),
        ),
      ),
  );
  for (const [first, ...rest] of chunked(statements, BATCH_SIZE)) {
    // `batch` wants at least one statement; a chunk always has one.
    if (first) {
      await db.batch([first, ...rest]);
    }
  }
}

/** How many recipes the user has an embedding for (a count, not the vectors). */
export async function countEmbeddings(
  db: Database,
  userId: number,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(embeddings)
    .where(eq(embeddings.user_id, userId));
  return row?.n ?? 0;
}
