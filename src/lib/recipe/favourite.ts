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
import { setFavourite } from '../db/favourites';
import { getRecipeByFileId } from '../db/recipes';
import { getUserById } from '../db/users';
import { getFileContent, updateRecipeFile } from '../drive/drive-client';
import { getDatabase, runInBackground } from '../util';
import { withFavouriteTag } from './favourite-tag';
import { indexRecipeWrite } from './tag-index';

/** Mirror the favourite marker into the recipe's file and refresh the cache. */
async function writeFavouriteTag(
  userId: number,
  driveFileId: string,
  on: boolean,
): Promise<void> {
  const db = getDatabase();
  const user = await getUserById(db, userId);
  if (!user || !isDriveConnected(user)) {
    // Without Drive the heart lives in the app only; the file marker is added
    // once the person has connected it and hearts the recipe again.
    return;
  }
  const token = await getUserAccessToken(user);
  const original = await getFileContent(driveFileId, token);
  const updated = withFavouriteTag(original, on);
  if (updated === original) {
    return;
  }
  await updateRecipeFile(driveFileId, updated, token);
  const row = await getRecipeByFileId(db, userId, driveFileId);
  if (row) {
    // A one-line metadata change doesn't alter what the recipe means, so skip
    // re-embedding it.
    await indexRecipeWrite(db, userId, driveFileId, row.name, updated, null, {
      embed: false,
    });
  }
}

/**
 * Heart or un-heart a recipe. Returns as soon as the table is updated; the file
 * marker follows in the background. Idempotent.
 */
export async function setFavouriteAndTag(
  userId: number,
  driveFileId: string,
  on: boolean,
): Promise<boolean> {
  const state = await setFavourite(getDatabase(), userId, driveFileId, on);
  runInBackground(writeFavouriteTag(userId, driveFileId, on));
  return state;
}
