/**
 * @packageDocumentation
 *
 * Wires {@link mutateRecipe} to the real Drive and D1 for a signed-in user.
 */

import { getUserAccessToken } from '../auth/current-user';
import { getRecipeByFileId } from '../db/recipes';
import type { User } from '../db/users';
import { getFileContent, updateRecipeFile } from '../drive/drive-client';
import { getDatabase } from '../util';
import { mutateRecipe, type Edit, type MutateOutcome } from './mutate-recipe';
import { indexRecipeWrite } from './tag-index';

/** Drive answers a missing file with a 404 inside the error message. */
const isDriveNotFound = (error: unknown) =>
  error instanceof Error && /-> 404/.test(error.message);

/** Change a recipe for a user, using their Drive and the D1 cache. */
export async function mutateRecipeForUser<T>(
  user: User,
  id: string,
  ifMatch: string | null,
  edit: (current: string) => Edit<T>,
): Promise<MutateOutcome<T>> {
  const db = getDatabase();
  const token = await getUserAccessToken(user);
  return mutateRecipe(
    {
      owns: async (fileId) =>
        Boolean(await getRecipeByFileId(db, user.id, fileId)),
      read: async (fileId) => {
        try {
          return await getFileContent(fileId, token);
        } catch (error) {
          if (isDriveNotFound(error)) {
            return undefined;
          }
          throw error;
        }
      },
      write: async (fileId, source) => {
        const row = await getRecipeByFileId(db, user.id, fileId);
        await updateRecipeFile(fileId, source, token);
        await indexRecipeWrite(
          db,
          user.id,
          fileId,
          row?.name ?? fileId,
          source,
        );
      },
    },
    id,
    ifMatch,
    edit,
  );
}
