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
  sessionHintStale,
  wasDriveConnected,
} from '../auth/drive-access';
import type { SessionPayload } from '../auth/session';
import type { Database } from '../db/client';
import { getAppPageRows, type AppPageRows } from '../db/recipe-page';
import type { User } from '../db/users';
import { getDatabase, getEnv, runInBackground } from '../util';
import { syncFromDrive } from './drive-sync';
import { backfillEmbeddings } from './embed-write';

/** Whether the person's Google Drive is connected, and how to word asking again. */
export interface DriveStatus {
  readonly connected: boolean;
  /** Not connected now, but was: Google stopped accepting the login. */
  readonly reconnect: boolean;
  /** Connected, but Drive could not be reached just now (so an empty list is not the truth). */
  readonly unreachable: boolean;
}

/** What the pages need: the cached recipe rows and which of them are hearted. */
export interface Collection {
  readonly recipes: AppPageRows['recipes'];
  /** Drive file ids the user has hearted. */
  readonly favouriteIds: readonly string[];
  /** Whether recipes can be synced from (and saved to) their Drive. */
  readonly drive: DriveStatus;
}

/**
 * Everything {@link loadCollection} reaches out to, gathered in one place so a
 * test can hand in small fakes. The default is the real session, database,
 * Drive sync and background queue.
 */
export interface CollectionDeps {
  /** The signed-in session from the cookie, if any. */
  readonly session: () => Promise<SessionPayload | null>;
  /** The D1 database. */
  readonly database: () => Database;
  /** The user, cached recipes, embedding count and favourites in one read. */
  readonly pageRows: (db: Database, userId: number) => Promise<AppPageRows>;
  /** Bring the cache in line with Drive. */
  readonly sync: (user: Readonly<User>) => Promise<unknown>;
  /** Embed up to `limit` recipes that have no embedding yet. */
  readonly backfill: (
    db: Database,
    userId: number,
    limit: number,
  ) => Promise<unknown>;
  /** Run work after the response, without waiting for it. */
  readonly background: (work: Promise<unknown>) => void;
  /** Send the visitor elsewhere; never returns. */
  readonly redirect: (to: string) => never;
}

/** The real thing. */
const liveDeps: CollectionDeps = {
  session: getSession,
  database: getDatabase,
  pageRows: getAppPageRows,
  sync: syncFromDrive,
  backfill: (db, userId, limit) =>
    backfillEmbeddings(db, getEnv(), userId, limit),
  background: runInBackground,
  redirect,
};

/** How many missing embeddings one visit tops up. */
const BACKFILL_PER_VISIT = 20;

/**
 * Sync a first-time visitor's Drive and wait for it, since there is nothing
 * cached to show yet. A rejected login was cleared by the sync; anything else
 * (a network blip) just leaves the list empty until the next visit.
 */
async function syncFirstVisit(
  deps: CollectionDeps,
  user: Readonly<User>,
): Promise<{ readonly connected: boolean; readonly unreachable: boolean }> {
  try {
    await deps.sync(user);
    return { connected: true, unreachable: false };
  } catch (error) {
    const connected = !(error instanceof DriveNotConnectedError);
    return { connected, unreachable: connected };
  }
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
 *
 * @param returnTo Where to come back to if the session needs reissuing.
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function loadCollection(
  returnTo: string = '/app',
  deps: CollectionDeps = liveDeps,
): Promise<Collection> {
  const session = (await deps.session()) ?? deps.redirect('/');
  const db = deps.database();
  const first = await deps.pageRows(db, session.uid);
  // The account is gone: start over.
  const user = first.user ?? deps.redirect('/');

  const hasDrive = isDriveConnected(user);
  const isFirstVisit = hasDrive && first.recipes.length === 0;
  // First visit: nothing cached yet, so sync once, wait for it, and read again.
  const status = isFirstVisit
    ? await syncFirstVisit(deps, user)
    : { connected: hasDrive, unreachable: false };
  const { recipes, embeddedCount, favouriteIds } = isFirstVisit
    ? await deps.pageRows(db, session.uid)
    : first;

  if (hasDrive && !isFirstVisit) {
    // Otherwise show the cache now and refresh it from Drive afterwards, so a
    // recipe added or removed directly in Drive appears on the next view.
    deps.background(deps.sync(user));
  }
  if (embeddedCount < recipes.length) {
    // Top up missing embeddings (bounded per visit) so "find similar" fills in.
    deps.background(deps.backfill(db, session.uid, BACKFILL_PER_VISIT));
  }
  if (sessionHintStale(session.drive, status.connected)) {
    // The header's idea of the Drive connection (kept in the session) is out of
    // date: Google revoked it, it was made on another device, or the cookie
    // predates the hint. A cookie can only be changed by a route, so go through
    // one and come straight back.
    deps.redirect(`/api/auth/refresh?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return {
    recipes,
    favouriteIds,
    drive: {
      connected: status.connected,
      reconnect: !status.connected && wasDriveConnected(user),
      unreachable: status.unreachable && recipes.length === 0,
    },
  };
}
