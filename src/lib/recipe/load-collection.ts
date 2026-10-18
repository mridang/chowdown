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

import { getSession } from '../auth/current-user';
import {
  DriveNotConnectedError,
  isDriveConnected,
  wasDriveConnected,
} from '../auth/drive-access';
import { getAppPageRows, type AppPageRows } from '../db/recipe-page';
import { getDatabase, getEnv, runInBackground } from '../util';
import { syncFromDrive } from './drive-sync';
import { backfillEmbeddings } from './embed-write';

/** Whether the person's Google Drive is connected, and how to word asking again. */
export interface DriveStatus {
  connected: boolean;
  /** Not connected now, but was: Google stopped accepting the login. */
  reconnect: boolean;
  /** Connected, but Drive could not be reached just now (so an empty list is not the truth). */
  unreachable: boolean;
}

/** What the pages need: the cached recipe rows and which of them are hearted. */
export interface Collection {
  recipes: AppPageRows['recipes'];
  /** Drive file ids the user has hearted. */
  favouriteIds: string[];
  /** Whether recipes can be synced from (and saved to) their Drive. */
  drive: DriveStatus;
}

/**
 * Load the collection for the signed-in person, or redirect.
 *
 * Identity comes from the signed cookie (no database read), and the user, the
 * cached recipes and the embedding count come back in ONE D1 round trip; no
 * Google or Drive call sits on the fast path. Someone signed out goes home.
 * Someone signed in without a Drive connection (never made, or Google rejected
 * it) gets whatever is cached and a `drive` status the page turns into an offer
 * to connect; nothing is synced for them.
 */
export async function loadCollection(
  returnTo: string = '/app',
): Promise<Collection> {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }
  const uid = session.uid;
  const db = getDatabase();
  let { user, recipes, embeddedCount, favouriteIds } = await getAppPageRows(
    db,
    uid,
  );
  if (!user) {
    // The account is gone: start over.
    redirect('/');
  }

  let connected = isDriveConnected(user);
  let unreachable = false;
  if (connected && recipes.length === 0) {
    // First visit: nothing cached yet, so sync once and wait for it.
    try {
      await syncFromDrive(user);
    } catch (error) {
      // A rejected login was cleared by the sync; anything else (a network
      // blip) just leaves the list empty until the next visit.
      connected = !(error instanceof DriveNotConnectedError);
      unreachable = connected;
    }
    ({ recipes, embeddedCount, favouriteIds } = await getAppPageRows(db, uid));
  } else if (connected) {
    // Otherwise show the cache now and refresh it from Drive afterwards, so a
    // recipe added or removed directly in Drive appears on the next view.
    runInBackground(syncFromDrive(user));
  }
  if (embeddedCount < recipes.length) {
    // Top up missing embeddings (bounded per visit) so "find similar" fills in.
    runInBackground(backfillEmbeddings(db, getEnv(), uid, 20));
  }
  if (session.drive !== undefined && session.drive !== connected) {
    // The header's idea of the Drive connection (kept in the session) is out of
    // date, say Google revoked it or it was made on another device. A cookie can
    // only be changed by a route, so go through one and come straight back.
    redirect(`/api/auth/refresh?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return {
    recipes,
    favouriteIds,
    drive: {
      connected,
      reconnect: !connected && wasDriveConnected(user),
      unreachable: unreachable && recipes.length === 0,
    },
  };
}
