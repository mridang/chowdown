/**
 * @packageDocumentation
 *
 * Everything the MCP tools reach for besides the user's Drive files: the
 * database, the AI models, the page fetcher. They sit behind one small
 * interface, {@link ToolServices}, for two reasons. The tools can then be tested
 * with fakes instead of a Cloudflare environment. And every real call is wrapped
 * here, in one place, so that when Google Drive, D1 or Workers AI fails the
 * tool answers "that service is having trouble, try again" (an `isError` result
 * the assistant can relay) instead of a bare protocol error.
 *
 * The wrapping is deliberately tight: {@link guarded} goes around a single
 * outside call, never around the tool's own logic, so a bug in our code is still
 * a loud failure rather than being reported as an outage.
 */

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import { listEmbeddings, type EmbeddingRow } from '@/domain/db/embeddings';
import { listFavouriteIds } from '@/domain/db/favourites';
import { findRecipeBySourceUrl, listRecipesByUser } from '@/domain/db/recipes';
import { setUserUnits, type User } from '@/domain/db/users';
import type { DriveFile } from '@/lib/google';
import { embedText } from '@/domain/recipe/embeddings';
import { setFavouriteAndTag } from '@/domain/recipe/favourite';
import type { ExistingRecipe } from '@/domain/recipe/import-recipe';
import { syncFromDrive } from '@/domain/recipe/drive-sync';
import { ensureEmbeddings } from '@/domain/recipe/similar';
import {
  tagCookSource,
  tagCookSourceBestEffort,
} from '@/domain/recipe/tagging';
import {
  addMissingCover,
  convertImport,
  type ConversionOptions,
} from '@/domain/recipe/to-cooklang';
import type { UnitSystem } from '@/lib/cooklang';
import { DAILY_BUDGETS, spendBudget } from '@/domain/daily-budget';
import { getEnv, runInBackground } from '@/lib/core/runtime';
import { getDatabase } from '@/domain/db/client';
import { errorMessage, logError } from '@/utils/logging';
import type { ScenarioDeps } from '@/domain/mcp/scenarios';
import type { FileOps } from '@/domain/mcp/tool-calls';
import { BackendFailure } from '@/lib/mcp';

/**
 * Run one outside call and turn any failure of it into a {@link BackendFailure}
 * naming the `service`. Failures that already mean something specific pass
 * through unchanged: Drive not being connected is explained to the person in its
 * own words, and a failure already named is not renamed.
 *
 * Wrap only the call itself (one Drive request, one query, one model run). The
 * tool's own logic stays outside, so a mistake there is not mistaken for an
 * outage.
 */
export async function guarded<T>(
  service: string,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (
      error instanceof DriveNotConnectedError ||
      error instanceof BackendFailure
    ) {
      throw error;
    }
    throw new BackendFailure(service, error);
  }
}

/**
 * Run an outside call whose failure must not fail the tool, such as refreshing
 * a cache after the real work has been saved. The failure is logged and the
 * tool carries on; whatever the call would have updated catches up the next time
 * it is read.
 */
async function bestEffort(
  service: string,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await guarded(service, work);
  } catch (error) {
    if (error instanceof DriveNotConnectedError) {
      throw error;
    }
    logError({
      event: 'mcp.refresh_failed',
      service,
      error: errorMessage(error),
    });
  }
}

/**
 * Wrap the Drive file operations so a Drive failure becomes a
 * {@link BackendFailure}, and the cache refresh that follows a write never fails
 * the tool (the file is already saved by then).
 */
export function guardFileOps(files: FileOps): FileOps {
  return {
    list: () => guarded('Google Drive', files.list),
    read: (fileId) => guarded('Google Drive', () => files.read(fileId)),
    create: (name, content) =>
      guarded('Google Drive', () => files.create(name, content)),
    update: (fileId, content) =>
      guarded('Google Drive', () => files.update(fileId, content)),
    index: (fileId, name, source) =>
      bestEffort('the recipe database', () =>
        files.index(fileId, name, source),
      ),
  };
}

/** How many recipes a single search call will index (embed) before answering. */
export const EMBEDDINGS_PER_CALL = 25;

/** What a search call can work from after indexing what it was allowed to. */
export interface IndexedRecipes {
  /** The embeddings of the recipes that are indexed. */
  readonly rows: readonly EmbeddingRow[];
  /** How many recipes still wait to be indexed by a later call. */
  readonly waiting: number;
}

/** Whether a file has no up-to-date embedding and so needs one made. */
function needsEmbedding(
  file: DriveFile,
  cached: EmbeddingRow | undefined,
): boolean {
  if (!cached) {
    return true;
  }
  // Same rules as `ensureEmbeddings`: current when the stamps agree, and a
  // vector made at write time (no stamp yet) only needs the stamp adopted.
  return !(
    cached.modified_time === (file.modifiedTime ?? null) ||
    (cached.modified_time === null && Boolean(file.modifiedTime))
  );
}

/**
 * Choose which files to hand to `ensureEmbeddings` so one call embeds at most
 * `limit` recipes, however large the folder is. Files that are indexed and
 * current always go through (the indexer does no work for them), so a folder
 * that is already indexed behaves exactly as before.
 *
 * Of the files that need an embedding, the first `limit` go through (the one
 * named by `first` leading, so the recipe a caller asked about is never the one
 * left out). The rest wait, and the indexer must not see them as gone, because
 * it deletes the embeddings of files it is not given:
 *
 * - a file never indexed has nothing to delete, so it is simply left out;
 * - a file indexed before but edited since keeps serving its old vector: it is
 *   handed over carrying the stamp of that old vector, which the indexer reads
 *   as "current".
 */
export function planBackfill(
  files: readonly DriveFile[],
  cached: readonly EmbeddingRow[],
  limit: number,
  first?: string,
): { readonly files: readonly DriveFile[]; readonly waiting: number } {
  const byId = new Map(cached.map((row) => [row.drive_file_id, row]));
  const pending = files.filter((f) => needsEmbedding(f, byId.get(f.id)));
  const chosen = new Set(
    [
      ...pending.filter((f) => f.id === first),
      ...pending.filter((f) => f.id !== first),
    ]
      .slice(0, limit)
      .map((f) => f.id),
  );
  const deferred = pending.filter((f) => !chosen.has(f.id));
  const deferredIds = new Set(deferred.map((f) => f.id));
  return {
    waiting: deferred.length,
    files: files.flatMap((file): readonly DriveFile[] => {
      if (!deferredIds.has(file.id)) {
        return [file];
      }
      const old = byId.get(file.id);
      return old
        ? [{ ...file, modifiedTime: old.modified_time ?? undefined }]
        : [];
    }),
  };
}

/** The outside things the tools use besides Drive files (see the file comment). */
export interface ToolServices {
  /**
   * Make sure the recipes are indexed for semantic search, embedding at most
   * {@link EMBEDDINGS_PER_CALL} new or changed ones, `first` before the rest.
   */
  readonly searchIndex: (
    user: Readonly<User>,
    files: readonly DriveFile[],
    token: string,
    first?: string,
  ) => Promise<IndexedRecipes>;
  /** Turn a search query into an embedding vector. */
  readonly embedQuery: (text: string) => Promise<readonly number[]>;
  /** The recipe this user already imported from a web address, if any. */
  readonly findImported: (
    userId: number,
    url: string,
  ) => Promise<ExistingRecipe | undefined>;
  /** Convert a web page's content into Cooklang. */
  readonly convertImport: (
    content: string,
    options: ConversionOptions,
  ) => Promise<string>;
  /** Tag a recipe's Cooklang; on failure, return it untouched. */
  readonly tagBestEffort: (source: string, name: string) => Promise<string>;
  /** Tag a recipe's Cooklang and say which tags were applied. */
  readonly tag: (
    source: string,
    filename: string,
  ) => Promise<{
    readonly source: string;
    readonly tags: readonly (readonly [string, string])[];
  }>;
  /** Add a cover image from the recipe's source page when it lacks one; never fails. */
  readonly addCover: (source: string) => Promise<string>;
  /** Heart or un-heart a recipe. */
  readonly setFavourite: (
    userId: number,
    fileId: string,
    on: boolean,
  ) => Promise<void>;
  /** Remember a user's measurement system. */
  readonly setUnits: (userId: number, system: UnitSystem) => Promise<void>;
  /**
   * Spend one unit of the person's daily allowance for tools that call a model
   * on an assistant's behalf. The seconds until it renews if it is used up,
   * else undefined.
   */
  readonly spendModelBudget: (userId: number) => Promise<number | undefined>;
  /** Where the browse, pantry and filter tools read the user's cached recipes. */
  readonly scenario: (user: Readonly<User>) => ScenarioDeps;
}

/** The real database, AI models and page fetcher, each guarded. */
export const liveToolServices: ToolServices = {
  searchIndex: async (user, files, token, first) => {
    const cached = await guarded('the recipe database', () =>
      listEmbeddings(getDatabase(), user.id),
    );
    const plan = planBackfill(files, cached, EMBEDDINGS_PER_CALL, first);
    return {
      rows: await guarded('the recipe search index', () =>
        ensureEmbeddings(user, plan.files, token),
      ),
      waiting: plan.waiting,
    };
  },
  embedQuery: (text) =>
    guarded('the AI model', () => embedText(getEnv(), text)),
  findImported: (userId, url) =>
    guarded('the recipe database', async () => {
      const row = await findRecipeBySourceUrl(getDatabase(), userId, url);
      return row
        ? { id: row.drive_file_id, name: row.name, source: row.source }
        : undefined;
    }),
  convertImport: (content, options) =>
    guarded('the recipe converter', () =>
      convertImport(content, getEnv(), options),
    ),
  tagBestEffort: (source, name) =>
    tagCookSourceBestEffort(source, name, getEnv()),
  tag: (source, filename) =>
    guarded('the recipe tagger', () =>
      tagCookSource(source, filename, getEnv()),
    ),
  addCover: addMissingCover,
  setFavourite: (userId, fileId, on) =>
    guarded('the recipe database', async () => {
      await setFavouriteAndTag(userId, fileId, on);
    }),
  setUnits: (userId, system) =>
    guarded('the recipe database', () =>
      setUserUnits(getDatabase(), userId, system),
    ),
  spendModelBudget: (userId) =>
    spendBudget(DAILY_BUDGETS.assistantModel, userId),
  scenario: (user) => ({
    rows: () =>
      guarded('the recipe database', () =>
        listRecipesByUser(getDatabase(), user.id),
      ),
    favouriteIds: () =>
      guarded('the recipe database', () =>
        listFavouriteIds(getDatabase(), user.id),
      ),
    // Not guarded: the scenario code decides which sync failures matter.
    sync: () => syncFromDrive(user),
    inBackground: runInBackground,
  }),
};
