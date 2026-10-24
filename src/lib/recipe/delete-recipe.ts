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

import { getUserAccessToken } from '@/lib/auth/user-access-token';
import type { Database } from '@/lib/db/client';
import { deleteRecipeData, getRecipeByFileId } from '@/lib/db/recipes';
import type { User } from '@/lib/db/users';
import { trashRecipeFile } from '@/lib/drive/drive-client';
import { getDatabase } from '@/lib/util';
import { refreshSimilarLists } from '@/lib/recipe/similar';

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

/**
 * What {@link deleteRecipeForUser} reaches out to, gathered in one place so a
 * test can hand in small fakes. The default is the real database and Drive.
 */
export interface DeleteLiveDeps {
  /** The D1 database. */
  readonly database: () => Database;
  /** A Drive access token for the user. */
  readonly accessToken: (user: Readonly<User>) => Promise<string>;
  /** The cached row for one of the user's recipes, if they have it. */
  readonly findRecipe: (
    db: Database,
    userId: number,
    fileId: string,
  ) => Promise<unknown>;
  /** Move a Drive file to the trash. */
  readonly trashFile: (
    fileId: string,
    token: string,
  ) => Promise<'trashed' | 'missing'>;
  /** Remove the recipe's cached row, embedding and favourite. */
  readonly deleteData: (
    db: Database,
    userId: number,
    fileId: string,
  ) => Promise<unknown>;
  /** Recompute everyone's similar lists. */
  readonly refreshSimilar: (db: Database, userId: number) => Promise<unknown>;
}

/** The real thing. */
const liveDeps: DeleteLiveDeps = {
  database: getDatabase,
  accessToken: getUserAccessToken,
  findRecipe: getRecipeByFileId,
  trashFile: trashRecipeFile,
  deleteData: deleteRecipeData,
  refreshSimilar: refreshSimilarLists,
};

/**
 * Delete a recipe for a signed-in user using the real Drive and D1.
 *
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function deleteRecipeForUser(
  user: Readonly<User>,
  id: string,
  deps: DeleteLiveDeps = liveDeps,
): Promise<DeleteOutcome> {
  const db = deps.database();
  const token = await deps.accessToken(user);
  return deleteRecipe(
    {
      owns: async (fileId) =>
        Boolean(await deps.findRecipe(db, user.id, fileId)),
      trash: (fileId) => deps.trashFile(fileId, token),
      forget: async (fileId) => {
        await deps.deleteData(db, user.id, fileId);
        // Other recipes may list this one as similar; recompute so none link
        // to a page that no longer exists.
        await deps.refreshSimilar(db, user.id);
      },
    },
    id,
  );
}
