/**
 * @packageDocumentation
 *
 * Bring the D1 recipe cache in line with the user's Drive folder. Pages render
 * straight from D1 (one fast round trip) and run this *in the background*, so a
 * recipe added or deleted directly in Drive shows up on the next view without
 * anyone waiting on Google or the Drive API.
 */

import { getUserAccessToken } from '../auth/current-user';
import { deleteEmbeddingsNotIn } from '../db/embeddings';
import { deleteRecipesNotIn } from '../db/recipes';
import { setRecipesFolderId, type User } from '../db/users';
import { ensureRecipesFolder, listRecipeFiles } from '../drive/drive-client';
import { getDatabase } from '../util';
import { syncRecipeTags } from './tag-index';

/**
 * Sync one user's Drive folder into D1: list the files, refresh the cached
 * source and tags of anything new or changed, and drop cache rows for files
 * that no longer exist. Returns the Drive file count.
 *
 * Throws {@link DriveNotConnectedError} if Drive isn't connected or Google no
 * longer accepts the stored login (which is cleared, so the person is offered
 * "reconnect"); other failures are left for the caller to ignore or report.
 */
export async function syncFromDrive(user: User): Promise<number> {
  const db = getDatabase();
  // Anything saved from here on is newer than the listing we are about to take,
  // so the prune below must leave it alone.
  const startedAt = new Date().toISOString();
  const token = await getUserAccessToken(user);
  let folderId = user.recipes_folder_id;
  if (!folderId) {
    folderId = await ensureRecipesFolder(token);
    await setRecipesFolderId(db, user.id, folderId);
  }
  const files = await listRecipeFiles(folderId, token);
  await syncRecipeTags(user, files, token);
  const keep = files.map((f) => f.id);
  await deleteRecipesNotIn(db, user.id, keep, startedAt);
  await deleteEmbeddingsNotIn(db, user.id, keep);
  return files.length;
}
