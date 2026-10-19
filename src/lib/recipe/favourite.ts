/**
 * @packageDocumentation
 *
 * Hearting a recipe, end to end. The favourites table in D1 is what the UI
 * reads, so it is written first and the caller gets an answer straight away. A
 * `>> favourite: true` marker is then mirrored into the recipe's `.cook` file in
 * the background (it needs a Google token and a Drive write, so it must never
 * make a heart wait), which keeps the favourite attached to the recipe in Drive.
 */

import { getUserAccessToken } from '../auth/current-user';
import { isDriveConnected } from '../auth/drive-access';
import type { Database } from '../db/client';
import { setFavourite } from '../db/favourites';
import { getRecipeByFileId } from '../db/recipes';
import { getUserById, type User } from '../db/users';
import { getFileContent, updateRecipeFile } from '../drive/drive-client';
import { getDatabase, runInBackground } from '../util';
import { withFavouriteTag } from './favourite-tag';
import { indexRecipeWrite } from './tag-index';

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

/** The real thing. */
const liveDeps: FavouriteDeps = {
  database: getDatabase,
  saveHeart: setFavourite,
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

/** Mirror the favourite marker into the recipe's file and refresh the cache. */
async function writeFavouriteTag(
  deps: FavouriteDeps,
  userId: number,
  driveFileId: string,
  on: boolean,
): Promise<void> {
  const db = deps.database();
  const user = await deps.findUser(db, userId);
  if (!user || !isDriveConnected(user)) {
    // Without Drive the heart lives in the app only; the file marker is added
    // once the person has connected it and hearts the recipe again.
    return;
  }
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
 * marker follows in the background. Idempotent.
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
  deps.background(writeFavouriteTag(deps, userId, driveFileId, on));
  return state;
}
