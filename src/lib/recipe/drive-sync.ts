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
import { clearRefreshToken, setRecipesFolderId, type User } from '../db/users';
import { ensureRecipesFolder, listRecipeFiles } from '../drive/drive-client';
import { getDatabase } from '../util';
import { syncRecipeTags } from './tag-index';

/**
 * Whether an error means Google rejected the stored login (an expired or
 * revoked refresh token), as opposed to a passing network or Drive hiccup. Only
 * the former should send the user back through sign-in.
 */
export function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /invalid_grant/i.test(message) ||
    /token refresh failed:\s*(400|401)/i.test(message)
  );
}

/**
 * Sync one user's Drive folder into D1: list the files, refresh the cached
 * source and tags of anything new or changed, and drop cache rows for files
 * that no longer exist. Returns the Drive file count.
 *
 * If Google rejects the stored refresh token, it is cleared so the user's next
 * visit goes through sign-in and captures a fresh one; other failures are left
 * for the caller to ignore or report.
 */
export async function syncFromDrive(user: User): Promise<number> {
  const db = getDatabase();
  try {
    const token = await getUserAccessToken(user);
    let folderId = user.recipes_folder_id;
    if (!folderId) {
      folderId = await ensureRecipesFolder(token);
      await setRecipesFolderId(db, user.id, folderId);
    }
    const files = await listRecipeFiles(folderId, token);
    await syncRecipeTags(user, files, token);
    const keep = files.map((f) => f.id);
    await deleteRecipesNotIn(db, user.id, keep);
    await deleteEmbeddingsNotIn(db, user.id, keep);
    return files.length;
  } catch (error) {
    if (isAuthFailure(error)) {
      await clearRefreshToken(db, user.id);
    }
    throw error;
  }
}
