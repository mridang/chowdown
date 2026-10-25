/**
 * @packageDocumentation
 *
 * The user's app-managed "Recipes" folder in Drive: find it (creating it on
 * first use) and remember its id so later calls skip the lookup.
 */

import { setRecipesFolderId } from '@/domain/db/users';
import type { User } from '@/domain/db/users';
import { getDatabase } from '@/domain/db/client';
import { DriveClient } from '@/lib/google';

/** Name of the app-managed folder created in each user's Drive. */
export const RECIPES_FOLDER_NAME = 'Recipes';

/**
 * Find the app-managed "Recipes" folder, creating it if absent. Returns the
 * folder id.
 */
export async function ensureRecipesFolder(
  accessToken: string,
): Promise<string> {
  return new DriveClient(accessToken).ensureFolder(RECIPES_FOLDER_NAME);
}

/** The id of the user's Recipes folder, creating and recording it if needed. */
export async function recipesFolderFor(
  user: Readonly<User>,
  accessToken: string,
): Promise<string> {
  if (user.recipes_folder_id) {
    return user.recipes_folder_id;
  }
  const folderId = await ensureRecipesFolder(accessToken);
  await setRecipesFolderId(getDatabase(), user.id, folderId);
  return folderId;
}
