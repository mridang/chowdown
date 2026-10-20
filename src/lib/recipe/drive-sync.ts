/**
 * @packageDocumentation
 *
 * Bring the D1 recipe cache in line with the user's Drive folder. Pages render
 * straight from D1 (one fast round trip) and run this *in the background*, so a
 * recipe added or deleted directly in Drive shows up on the next view without
 * anyone waiting on Google or the Drive API.
 */

import { getUserAccessToken } from '../auth/user-access-token';
import type { Database } from '../db/client';
import { deleteOrphanEmbeddings } from '../db/embeddings';
import { deleteRecipesNotIn } from '../db/recipes';
import { setRecipesFolderId, type User } from '../db/users';
import {
  ensureRecipesFolder,
  listRecipeFiles,
  type DriveFile,
} from '../drive/drive-client';
import { getDatabase } from '../util';
import { syncRecipeTags } from './tag-index';

/**
 * Everything {@link syncFromDrive} reaches out to, gathered in one place so a
 * test can hand in small fakes. The default is the real database, Google Drive
 * and tag index.
 */
export interface DriveSyncDeps {
  /** The D1 database the cache lives in. */
  readonly database: () => Database;
  /** The current time as an ISO string. */
  readonly now: () => string;
  /** A working Drive access token for the user (throws if not connected). */
  readonly accessToken: (user: Readonly<User>) => Promise<string>;
  /** Find or create the Drive "Recipes" folder, returning its id. */
  readonly ensureFolder: (token: string) => Promise<string>;
  /** Remember the folder id on the user. */
  readonly rememberFolder: (
    db: Database,
    userId: number,
    folderId: string,
  ) => Promise<void>;
  /** The recipe files in the folder. */
  readonly listFiles: (
    folderId: string,
    token: string,
  ) => Promise<readonly DriveFile[]>;
  /** Refresh the cached source and tags of new or changed files. */
  readonly syncTags: (
    user: Readonly<User>,
    files: readonly DriveFile[],
    token: string,
  ) => Promise<unknown>;
  /** Drop cache rows for files not in `keep` that were not saved after `since`. */
  readonly pruneRecipes: (
    db: Database,
    userId: number,
    keep: readonly string[],
    since: string,
  ) => Promise<unknown>;
  /** Drop embeddings whose recipe is gone. */
  readonly pruneEmbeddings: (db: Database, userId: number) => Promise<unknown>;
}

/** The real thing: D1, Google Drive and the tag index. */
const liveDeps: DriveSyncDeps = {
  database: getDatabase,
  now: () => new Date().toISOString(),
  accessToken: getUserAccessToken,
  ensureFolder: ensureRecipesFolder,
  rememberFolder: setRecipesFolderId,
  listFiles: listRecipeFiles,
  syncTags: syncRecipeTags,
  // The database helper takes a plain array; hand it a copy of ours.
  pruneRecipes: (db, userId, keep, since) =>
    deleteRecipesNotIn(db, userId, [...keep], since),
  pruneEmbeddings: deleteOrphanEmbeddings,
};

/**
 * The id of the user's recipes folder in Drive: the one we remembered, or, for
 * someone syncing for the first time, a freshly created one that we remember
 * from now on.
 *
 * @param deps How to create the folder and remember it; the real Drive and
 *   database unless a test says otherwise.
 */
export async function recipesFolderOf(
  db: Database,
  user: Readonly<User>,
  token: string,
  deps: Pick<DriveSyncDeps, 'ensureFolder' | 'rememberFolder'> = liveDeps,
): Promise<string> {
  if (user.recipes_folder_id) {
    return user.recipes_folder_id;
  }
  const folderId = await deps.ensureFolder(token);
  await deps.rememberFolder(db, user.id, folderId);
  return folderId;
}

/**
 * Sync one user's Drive folder into D1: list the files, refresh the cached
 * source and tags of anything new or changed, and drop cache rows for files
 * that no longer exist. Returns the Drive file count.
 *
 * Throws {@link DriveNotConnectedError} if Drive isn't connected or Google no
 * longer accepts the stored login (which is cleared, so the person is offered
 * "reconnect"); other failures are left for the caller to ignore or report.
 *
 * @param user The signed-in user whose folder is synced.
 * @param deps Collaborators; leave out to use the real database and Drive.
 */
export async function syncFromDrive(
  user: Readonly<User>,
  deps: DriveSyncDeps = liveDeps,
): Promise<number> {
  const db = deps.database();
  // Anything saved from here on is newer than the listing we are about to take,
  // so the prune below must leave it alone.
  const startedAt = deps.now();
  const token = await deps.accessToken(user);
  const folderId = await recipesFolderOf(db, user, token, deps);
  const files = await deps.listFiles(folderId, token);
  await deps.syncTags(user, files, token);
  await deps.pruneRecipes(
    db,
    user.id,
    files.map((f) => f.id),
    startedAt,
  );
  await deps.pruneEmbeddings(db, user.id);
  return files.length;
}
