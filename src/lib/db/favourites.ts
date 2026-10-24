/**
 * @packageDocumentation
 *
 * Repository for the `favourites` table — the recipes a user has hearted,
 * keyed by Drive file id. Hearts live in D1 (not Drive) so toggling is instant
 * and popularity can be counted here.
 */

import { and, eq } from 'drizzle-orm';

import type { Database } from '@/core/db/client';
import { favourites } from '@/lib/db/schema';

/** Whether the user has hearted a given recipe. */
export async function isFavourite(
  db: Database,
  userId: number,
  driveFileId: string,
): Promise<boolean> {
  const row = await db.query.favourites.findFirst({
    where: and(
      eq(favourites.user_id, userId),
      eq(favourites.drive_file_id, driveFileId),
    ),
  });
  return Boolean(row);
}

/** The Drive file ids the user has hearted. */
export async function listFavouriteIds(
  db: Database,
  userId: number,
): Promise<readonly string[]> {
  const rows = await db.query.favourites.findMany({
    where: eq(favourites.user_id, userId),
  });
  return rows.map((r) => r.drive_file_id);
}

/**
 * Add or remove a heart. Idempotent: hearting twice is a no-op, unhearting
 * something that isn't hearted is a no-op. Returns the resulting state.
 */
export async function setFavourite(
  db: Database,
  userId: number,
  driveFileId: string,
  on: boolean,
): Promise<boolean> {
  if (on) {
    await db
      .insert(favourites)
      .values({
        user_id: userId,
        drive_file_id: driveFileId,
        created_at: new Date().toISOString(),
      })
      .onConflictDoNothing();
    return true;
  }
  await db
    .delete(favourites)
    .where(
      and(
        eq(favourites.user_id, userId),
        eq(favourites.drive_file_id, driveFileId),
      ),
    );
  return false;
}
