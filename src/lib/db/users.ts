/**
 * @packageDocumentation
 *
 * Repository for the `users` table: the per-account record created on first
 * Google sign-in. Holds identity, the sealed Drive refresh token (present only
 * once Drive is connected) and the id of the app-managed Recipes folder.
 */

import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';

import type { Database } from '@/core/db/client';
import { users } from '@/lib/db/schema';

/** A full user row. */
export type User = typeof users.$inferSelect;

/** Current time as an ISO-8601 string (the format every timestamp column uses). */
function now(): string {
  return new Date().toISOString();
}

/**
 * Insert the user on first sign-in, or refresh their identity fields on
 * return. `google_sub` is the stable key. The refresh token is only overwritten when a new
 * one is supplied (Google omits it on silent re-grants).
 */
export async function upsertUser(
  db: Database,
  input: Readonly<{
    google_sub: string;
    email: string;
    name?: string;
    picture?: string;
    refresh_token_enc?: string;
  }>,
): Promise<User> {
  const timestamp = now();
  // Only what was supplied is overwritten on return visits.
  const update: Partial<typeof users.$inferInsert> = {
    email: input.email,
    updated_at: timestamp,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.picture !== undefined ? { picture: input.picture } : {}),
    ...(input.refresh_token_enc !== undefined
      ? { refresh_token_enc: input.refresh_token_enc }
      : {}),
  };

  const [row] = await db
    .insert(users)
    .values({
      google_sub: input.google_sub,
      email: input.email,
      name: input.name ?? null,
      picture: input.picture ?? null,
      refresh_token_enc: input.refresh_token_enc ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .onConflictDoUpdate({ target: users.google_sub, set: update })
    .returning();
  if (!row) {
    throw new Error('Saving the user returned no row');
  }
  return row;
}

/** Fetch a user by primary key. */
export async function getUserById(
  db: Database,
  id: number,
): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/** Store the user's preferred measurement system ('metric' | 'us' | 'imperial'), or clear it with null. */
export async function setUserUnits(
  db: Database,
  userId: number,
  units: string | null,
): Promise<void> {
  await db
    .update(users)
    .set({ units, updated_at: now() })
    .where(eq(users.id, userId));
}

/** Store the id of the user's app-managed Recipes folder. */
export async function setRecipesFolderId(
  db: Database,
  userId: number,
  folderId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ recipes_folder_id: folderId, updated_at: now() })
    .where(eq(users.id, userId));
}

/** Store the sealed Drive refresh token that connecting Drive produced. */
export async function setRefreshToken(
  db: Database,
  userId: number,
  refreshTokenEnc: string,
): Promise<void> {
  await db
    .update(users)
    .set({ refresh_token_enc: refreshTokenEnc, updated_at: now() })
    .where(eq(users.id, userId));
}

/**
 * Forget a user's stored Drive refresh token. Used when Google rejects it
 * (expired or revoked): the next visit sees no connection and offers to
 * reconnect, which captures a fresh one. `onlyIf` is the sealed value that
 * failed: if the person has reconnected in the meantime, the row holds a newer
 * token and is left alone, so a slow background task can't undo a reconnect.
 */
export async function clearRefreshToken(
  db: Database,
  userId: number,
  onlyIf?: string,
): Promise<void> {
  await db
    .update(users)
    .set({ refresh_token_enc: null, updated_at: now() })
    .where(
      onlyIf === undefined
        ? eq(users.id, userId)
        : and(eq(users.id, userId), eq(users.refresh_token_enc, onlyIf)),
    );
}

/**
 * The epoch the person's sessions must carry to be honoured, or undefined when
 * the account no longer exists. One small read, for callers that must check a
 * session is still valid but have no use for the rest of the row.
 */
export async function getSessionEpoch(
  db: Database,
  userId: number,
): Promise<number | undefined> {
  const [row] = await db
    .select({ epoch: users.session_epoch })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.epoch;
}

/**
 * End every session the person has, on every device, by moving to the next
 * epoch: cookies issued under the old one stop being honoured at once.
 */
export async function bumpSessionEpoch(
  db: Database,
  userId: number,
): Promise<void> {
  await db
    .update(users)
    .set({ session_epoch: sql`${users.session_epoch} + 1`, updated_at: now() })
    .where(eq(users.id, userId));
}

/** How long after a sync starts before another may (one minute). */
export const SYNC_INTERVAL_MS = 60_000;

/** How long one request may hold the embeddings backfill (two minutes). */
export const BACKFILL_LEASE_MS = 120_000;

/**
 * Try to take the right to start a Drive sync for the person. True means the
 * last sync started over {@link SYNC_INTERVAL_MS} ago (or never) and this
 * caller has just taken the turn; false means one started recently and this
 * caller should skip. It is a single conditional UPDATE, so of several views
 * arriving together exactly one wins.
 */
export async function claimDriveSync(
  db: Database,
  userId: number,
  at: Date = new Date(),
): Promise<boolean> {
  const cutoff = new Date(at.getTime() - SYNC_INTERVAL_MS).toISOString();
  const result = await db
    .update(users)
    .set({ last_synced_at: at.toISOString() })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.last_synced_at), lte(users.last_synced_at, cutoff)),
      ),
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Try to take the lease on the embeddings backfill for {@link BACKFILL_LEASE_MS}.
 * True means no one else holds a live lease and this caller now does; false
 * means another request is already doing the job. Same single-UPDATE guarantee
 * as {@link claimDriveSync}. A lease that is never released simply runs out.
 */
export async function claimBackfillLease(
  db: Database,
  userId: number,
  at: Date = new Date(),
): Promise<boolean> {
  const until = new Date(at.getTime() + BACKFILL_LEASE_MS).toISOString();
  const result = await db
    .update(users)
    .set({ backfill_lease_until: until })
    .where(
      and(
        eq(users.id, userId),
        or(
          isNull(users.backfill_lease_until),
          lte(users.backfill_lease_until, at.toISOString()),
        ),
      ),
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}
