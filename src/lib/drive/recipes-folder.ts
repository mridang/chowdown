/**
 * @packageDocumentation
 *
 * The user's app-managed "Recipes" folder in Drive: find it (creating it on
 * first use) and remember its id so later calls skip the lookup.
 */

import { setRecipesFolderId } from '../db/users';
import type { User } from '../db/users';
import { getDatabase } from '../util';
import { ensureRecipesFolder } from './drive-client';

/** The id of the user's Recipes folder, creating and recording it if needed. */
export async function recipesFolderFor(
  user: User,
  accessToken: string,
): Promise<string> {
  if (user.recipes_folder_id) {
    return user.recipes_folder_id;
  }
  const folderId = await ensureRecipesFolder(accessToken);
  await setRecipesFolderId(getDatabase(), user.id, folderId);
  return folderId;
}
