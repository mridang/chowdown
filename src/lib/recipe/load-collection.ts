/**
 * @packageDocumentation
 *
 * The signed-in person's recipe collection, loaded the way every page that
 * lists recipes needs it: from the D1 cache in a single round trip, with the
 * Drive sync and the embeddings top-up kicked off around it. The recipe grid
 * and the signed-in home both start here, so they redirect, sync and refresh
 * in exactly the same way.
 */

import { redirect } from 'next/navigation';

import { getSessionUid } from '../auth/current-user';
import { getAppPageRows, type AppPageRows } from '../db/recipe-page';
import { getDatabase, getEnv, runInBackground } from '../util';
import { syncFromDrive } from './drive-sync';
import { backfillEmbeddings } from './embed-write';

/** What the pages need: the cached recipe rows and which of them are hearted. */
export interface Collection {
  recipes: AppPageRows['recipes'];
  /** Drive file ids the user has hearted. */
  favouriteIds: string[];
}

/**
 * Load the collection for the signed-in person, or redirect.
 *
 * Identity comes from the signed cookie (no database read), and the user, the
 * cached recipes and the embedding count come back in ONE D1 round trip; no
 * Google or Drive call sits on the fast path. Someone signed out goes home, and
 * someone whose Google login was rejected is sent to sign in again.
 */
export async function loadCollection(): Promise<Collection> {
  const uid = await getSessionUid();
  if (uid === null) {
    redirect('/');
  }
  const db = getDatabase();
  let { user, recipes, embeddedCount, favouriteIds } = await getAppPageRows(
    db,
    uid,
  );
  if (!user || !user.refresh_token_enc) {
    // Unknown user, or Google rejected the stored login: sign in again.
    redirect(user ? '/api/auth/login' : '/');
  }

  if (recipes.length === 0) {
    // First visit: nothing cached yet, so sync once and wait for it.
    try {
      await syncFromDrive(user);
    } catch {
      redirect('/api/auth/login');
    }
    ({ recipes, embeddedCount, favouriteIds } = await getAppPageRows(db, uid));
  } else {
    // Otherwise show the cache now and refresh it from Drive afterwards, so a
    // recipe added or removed directly in Drive appears on the next view.
    runInBackground(syncFromDrive(user));
  }
  if (embeddedCount < recipes.length) {
    // Top up missing embeddings (bounded per visit) so "find similar" fills in.
    runInBackground(backfillEmbeddings(db, getEnv(), uid, 20));
  }
  return { recipes, favouriteIds };
}
