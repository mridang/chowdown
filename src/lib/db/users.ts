/**
 * @packageDocumentation
 *
 * Repository for the `users` table: the per-account record created on first
 * Google sign-in. Holds identity, the sealed Drive refresh token (present only
 * once Drive is connected) and the id of the app-managed Recipes folder.
 */

import { and, eq } from 'drizzle-orm';

import type { Database } from './client';
import { users } from './schema';

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
  input: {
    google_sub: string;
    email: string;
    name?: string;
    picture?: string;
    refresh_token_enc?: string;
  },
): Promise<User> {
  const timestamp = now();
  const update: Partial<typeof users.$inferInsert> = {
    email: input.email,
    updated_at: timestamp,
  };
  if (input.name !== undefined) {
    update.name = input.name;
  }
  if (input.picture !== undefined) {
    update.picture = input.picture;
  }
  if (input.refresh_token_enc !== undefined) {
    update.refresh_token_enc = input.refresh_token_enc;
  }

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
  return row!;
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
