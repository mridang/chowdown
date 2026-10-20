/**
 * @packageDocumentation
 *
 * Wires {@link mutateRecipe} to the real Drive and D1 for a signed-in user.
 */

import { getUserAccessToken } from '../auth/user-access-token';
import type { Database } from '../db/client';
import { getRecipeByFileId } from '../db/recipes';
import type { User } from '../db/users';
import { getFileContent, updateRecipeFile } from '../drive/drive-client';
import { getDatabase } from '../util';
import { mutateRecipe, type Edit, type MutateOutcome } from './mutate-recipe';
import { indexRecipeWrite } from './tag-index';

/**
 * What {@link mutateRecipeForUser} reaches out to, gathered in one place so a
 * test can hand in small fakes. The default is the real database, Drive and
 * tag index.
 */
export interface MutateLiveDeps {
  /** The D1 database. */
  readonly database: () => Database;
  /** A Drive access token for the user. */
  readonly accessToken: (user: Readonly<User>) => Promise<string>;
  /** The cached row for one of the user's recipes, if they have it. */
  readonly findRecipe: (
    db: Database,
    userId: number,
    fileId: string,
  ) => Promise<{ readonly name: string } | undefined>;
  /** Read a file's text from Drive. */
  readonly readFile: (fileId: string, token: string) => Promise<string>;
  /** Overwrite a file's text in Drive. */
  readonly writeFile: (
    fileId: string,
    source: string,
    token: string,
  ) => Promise<unknown>;
  /** Refresh the cached row (source and tags) after a write. */
  readonly index: (
    db: Database,
    userId: number,
    fileId: string,
    name: string,
    source: string,
  ) => Promise<unknown>;
}

/** The real thing. */
const liveDeps: MutateLiveDeps = {
  database: getDatabase,
  accessToken: getUserAccessToken,
  findRecipe: getRecipeByFileId,
  readFile: getFileContent,
  writeFile: updateRecipeFile,
  index: (db, userId, fileId, name, source) =>
    indexRecipeWrite(db, userId, fileId, name, source),
};

/** Drive answers a missing file with a 404 inside the error message. */
const isDriveNotFound = (error: unknown) =>
  error instanceof Error && /-> 404/.test(error.message);

/**
 * Change a recipe for a user, using their Drive and the D1 cache.
 *
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function mutateRecipeForUser<T>(
  user: Readonly<User>,
  id: string,
  ifMatch: string | null,
  edit: (current: string) => Edit<T>,
  deps: MutateLiveDeps = liveDeps,
): Promise<MutateOutcome<T>> {
  const db = deps.database();
  const token = await deps.accessToken(user);
  return mutateRecipe(
    {
      owns: async (fileId) =>
        Boolean(await deps.findRecipe(db, user.id, fileId)),
      read: async (fileId) => {
        try {
          return await deps.readFile(fileId, token);
        } catch (error) {
          if (isDriveNotFound(error)) {
            return undefined;
          }
          throw error;
        }
      },
      write: async (fileId, source) => {
        const row = await deps.findRecipe(db, user.id, fileId);
        await deps.writeFile(fileId, source, token);
        await deps.index(db, user.id, fileId, row?.name ?? fileId, source);
      },
    },
    id,
    ifMatch,
    edit,
  );
}
