/**
 * @packageDocumentation
 *
 * Hearting a recipe, end to end. The favourites table in D1 is what the UI
 * reads, so it is written first and the caller gets an answer straight away. A
 * `>> favourite: true` marker is then mirrored into the recipe's `.cook` file in
 * the background (it needs a Google token and a Drive write, so it must never
 * make a heart wait), which keeps the favourite attached to the recipe in Drive.
 */

import { getUserAccessToken } from '@/lib/auth/user-access-token';
import { isDriveConnected } from '@/lib/auth/drive-access';
import type { Database } from '@/lib/db/client';
import { isFavourite, setFavourite } from '@/lib/db/favourites';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { getUserById, type User } from '@/lib/db/users';
import { getFileContent, updateRecipeFile } from '@/lib/drive/drive-client';
import { getDatabase, runInBackground } from '@/lib/util';
import { withFavouriteTag } from '@/lib/recipe/favourite-tag';
import { createKeyedQueue } from '@/lib/recipe/keyed-queue';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';

/**
 * What hearting a recipe reaches out to, gathered in one place so a test can
 * hand in small fakes. The default is the real database, Drive and background
 * queue.
 */
export interface FavouriteDeps {
  /** The D1 database. */
  readonly database: () => Database;
  /** Record the heart in the favourites table; resolves to the new state. */
  readonly saveHeart: (
    db: Database,
    userId: number,
    fileId: string,
    on: boolean,
  ) => Promise<boolean>;
  /** Whether the recipe is hearted right now, read when the file is updated. */
  readonly readHeart: (
    db: Database,
    userId: number,
    fileId: string,
  ) => Promise<boolean>;
  /**
   * Run a job after any earlier job for the same key, never alongside it
   * (see {@link createKeyedQueue}).
   */
  readonly serialise: (
    key: string,
    job: () => Promise<void>,
  ) => Promise<unknown>;
  /** The user row, if the account still exists. */
  readonly findUser: (db: Database, id: number) => Promise<User | undefined>;
  /** A Drive access token for the user. */
  readonly accessToken: (user: Readonly<User>) => Promise<string>;
  /** Read a file's text from Drive. */
  readonly readFile: (fileId: string, token: string) => Promise<string>;
  /** Overwrite a file's text in Drive. */
  readonly writeFile: (
    fileId: string,
    source: string,
    token: string,
  ) => Promise<unknown>;
  /** The cached row for one of the user's recipes, if they have it. */
  readonly findRecipe: (
    db: Database,
    userId: number,
    fileId: string,
  ) => Promise<{ readonly name: string } | undefined>;
  /** Refresh the cached row after the file changed (no re-embedding). */
  readonly index: (
    db: Database,
    userId: number,
    fileId: string,
    name: string,
    source: string,
  ) => Promise<unknown>;
  /** Run work after the response, without waiting for it. */
  readonly background: (work: Promise<unknown>) => void;
}

/** Orders the Drive updates for one recipe within this server instance. */
const fileUpdates = createKeyedQueue();

/** The real thing. */
const liveDeps: FavouriteDeps = {
  database: getDatabase,
  saveHeart: setFavourite,
  readHeart: isFavourite,
  serialise: fileUpdates.run,
  findUser: getUserById,
  accessToken: getUserAccessToken,
  readFile: getFileContent,
  writeFile: updateRecipeFile,
  findRecipe: getRecipeByFileId,
  // A one-line metadata change doesn't alter what the recipe means, so skip
  // re-embedding it.
  index: (db, userId, fileId, name, source) =>
    indexRecipeWrite(db, userId, fileId, name, source, null, { embed: false }),
  background: runInBackground,
};

/**
 * Mirror the heart's CURRENT state into the recipe's file and refresh the
 * cache. The state is read from the table when the job runs, not taken from
 * the request that queued it: with quick on/off/on clicks the jobs may run
 * late, and whichever runs last must write what the person last chose.
 */
async function writeFavouriteTag(
  deps: FavouriteDeps,
  userId: number,
  driveFileId: string,
): Promise<void> {
  const db = deps.database();
  const user = await deps.findUser(db, userId);
  if (!user || !isDriveConnected(user)) {
    // Without Drive the heart lives in the app only; the file marker is added
    // once the person has connected it and hearts the recipe again.
    return;
  }
  const on = await deps.readHeart(db, userId, driveFileId);
  const token = await deps.accessToken(user);
  const original = await deps.readFile(driveFileId, token);
  const updated = withFavouriteTag(original, on);
  if (updated === original) {
    return;
  }
  await deps.writeFile(driveFileId, updated, token);
  const row = await deps.findRecipe(db, userId, driveFileId);
  if (row) {
    await deps.index(db, userId, driveFileId, row.name, updated);
  }
}

/**
 * Heart or un-heart a recipe. Returns as soon as the table is updated; the file
 * marker follows in the background, one update per recipe at a time. Idempotent.
 *
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function setFavouriteAndTag(
  userId: number,
  driveFileId: string,
  on: boolean,
  deps: FavouriteDeps = liveDeps,
): Promise<boolean> {
  const state = await deps.saveHeart(deps.database(), userId, driveFileId, on);
  deps.background(
    deps.serialise(`${userId}:${driveFileId}`, () =>
      writeFavouriteTag(deps, userId, driveFileId),
    ),
  );
  return state;
}
