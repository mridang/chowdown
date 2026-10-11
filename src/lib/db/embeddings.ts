/**
 * @packageDocumentation
 *
 * Repository for the `embeddings` cache — one vector per recipe, keyed by the
 * Drive file id and stamped with the file's `modified_time` so a recipe is only
 * re-embedded when it actually changes.
 */

import { and, eq, notInArray } from 'drizzle-orm';

import type { Database } from './client';
import { embeddings } from './schema';

/** A cached embedding row. */
export type EmbeddingRow = typeof embeddings.$inferSelect;

/** All cached embeddings for a user. */
export async function listEmbeddings(
  db: Database,
  userId: number,
): Promise<EmbeddingRow[]> {
  return db.query.embeddings.findMany({ where: eq(embeddings.user_id, userId) });
}

/** Insert or update a recipe's cached embedding. */
export async function upsertEmbedding(
  db: Database,
  input: {
    user_id: number;
    drive_file_id: string;
    title: string;
    modified_time: string | null;
    vector: string;
  },
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

/** Drop cached embeddings for files that no longer exist in the folder. */
export async function deleteEmbeddingsNotIn(
  db: Database,
  userId: number,
  keepFileIds: string[],
): Promise<void> {
  if (keepFileIds.length === 0) {
    await db.delete(embeddings).where(eq(embeddings.user_id, userId));
    return;
  }
  await db
    .delete(embeddings)
    .where(
      and(
        eq(embeddings.user_id, userId),
        notInArray(embeddings.drive_file_id, keepFileIds),
      ),
    );
}
