/**
 * @packageDocumentation
 *
 * Deleting a recipe, end to end. The decision logic is free of I/O so it can be
 * tested: the Drive, D1 and similarity work is passed in as dependencies, and
 * `deleteRecipeForUser` wires in the real ones.
 *
 * The recipe file is moved to the Drive **trash** rather than destroyed, so a
 * mistaken delete can still be undone from Drive. Only then is the cache
 * forgotten: if Drive refuses, nothing local changes and the recipe stays put.
 */

import { getUserAccessToken } from '../auth/current-user';
import { deleteRecipeData, getRecipeByFileId } from '../db/recipes';
import type { User } from '../db/users';
import { trashRecipeFile } from '../drive/drive-client';
import { getDatabase } from '../util';
import { refreshSimilarLists } from './similar';

/** The side effects a delete needs, injected so the logic is testable. */
export interface DeleteDeps {
  /** Whether this user has a recipe with this id. */
  owns(id: string): Promise<boolean>;
  /** Move the recipe's Drive file to the trash. */
  trash(id: string): Promise<'trashed' | 'missing'>;
  /** Forget the recipe in the cache and drop it from "find similar" lists. */
  forget(id: string): Promise<void>;
}

/** `'not-found'` means the user has no such recipe; nothing was touched. */
export type DeleteOutcome = 'deleted' | 'not-found';

/**
 * Delete one recipe. A file that is already gone from Drive still has its cache
 * cleaned up, so a half-finished earlier attempt can be completed by retrying.
 */
export async function deleteRecipe(
  deps: DeleteDeps,
  id: string,
): Promise<DeleteOutcome> {
  if (!(await deps.owns(id))) {
    return 'not-found';
  }
  await deps.trash(id);
  await deps.forget(id);
  return 'deleted';
}

/** Delete a recipe for a signed-in user using the real Drive and D1. */
export async function deleteRecipeForUser(
  user: User,
  id: string,
): Promise<DeleteOutcome> {
  const db = getDatabase();
  const token = await getUserAccessToken(user);
  return deleteRecipe(
    {
      owns: async (fileId) =>
        Boolean(await getRecipeByFileId(db, user.id, fileId)),
      trash: (fileId) => trashRecipeFile(fileId, token),
      forget: async (fileId) => {
        await deleteRecipeData(db, user.id, fileId);
        // Other recipes may list this one as similar; recompute so none link
        // to a page that no longer exists.
        await refreshSimilarLists(db, user.id);
      },
    },
    id,
  );
}
