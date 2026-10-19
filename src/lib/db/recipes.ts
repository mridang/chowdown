/**
 * @packageDocumentation
 *
 * Repository for the `recipes` table — the per-user read cache of the `.cook`
 * files in their Drive folder. Drive stays the source of truth; this cache is
 * what makes the recipe list render instantly and lets the headless MCP answer
 * without a live Drive round-trip. Rows are keyed by the Drive file id and
 * upserted during sync.
 */

import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  notLike,
} from 'drizzle-orm';

import { normalizeSourceUrl, sourceUrlOf } from '../recipe/cook-text';
import { chunked } from './chunk';
import type { Database } from './client';
import { embeddings, favourites, recipes } from './schema';

/** A full recipe row. */
export type Recipe = typeof recipes.$inferSelect;

/** Current time as an ISO-8601 string (the format every timestamp column uses). */
function now(): string {
  return new Date().toISOString();
}

/**
 * What goes in `recipes.source_url` for a recipe's source text: the normalised
 * address of its `>> source:` line, or the empty string when it has none. (Null
 * is reserved for "not worked out yet", which is how rows cached before the
 * column existed look.)
 */
function indexedSourceUrl(source: string): string {
  const url = sourceUrlOf(source);
  return url === undefined ? '' : normalizeSourceUrl(url);
}

/**
 * Insert or update a cached recipe, identified by its owner and its Drive file
 * id together. On first sight the `first_opened_at`/`last_opened_at` stamps are
 * set; on update only the content-derived fields and `last_opened_at` change.
 *
 * The conflict target is the pair, so a row is only ever updated by the person
 * it belongs to. If another person already holds the same Drive file id the
 * insert is refused by the table's older global uniqueness rule (kept so the
 * previous release still works) and throws, rather than quietly replacing the
 * first person's recipe text.
 */
export async function upsertRecipe(
  db: Database,
  input: Readonly<{
    user_id: number;
    drive_file_id: string;
    name: string;
    title?: string | null;
    source: string;
    modified_time?: string | null;
    parse_error?: string | null;
    /** Curated taxonomy tags as a JSON string (`{ facet: string[] }`). */
    tags?: string | null;
  }>,
): Promise<void> {
  const timestamp = now();
  await db
    .insert(recipes)
    .values({
      user_id: input.user_id,
      drive_file_id: input.drive_file_id,
      name: input.name,
      title: input.title ?? null,
      source: input.source,
      modified_time: input.modified_time ?? null,
      parse_error: input.parse_error ?? null,
      tags: input.tags ?? null,
      source_url: indexedSourceUrl(input.source),
      first_opened_at: timestamp,
      last_opened_at: timestamp,
    })
    .onConflictDoUpdate({
      target: [recipes.user_id, recipes.drive_file_id],
      set: {
        name: input.name,
        title: input.title ?? null,
        source: input.source,
        modified_time: input.modified_time ?? null,
        parse_error: input.parse_error ?? null,
        tags: input.tags ?? null,
        source_url: indexedSourceUrl(input.source),
        last_opened_at: timestamp,
      },
    });
}

/** All cached recipes for a user, most-recently-modified-looking order by name. */
export async function listRecipesByUser(
  db: Database,
  userId: number,
): Promise<readonly Recipe[]> {
  return db.query.recipes.findMany({
    where: eq(recipes.user_id, userId),
    orderBy: (r, { asc }) => [asc(r.name)],
  });
}

/** Fetch one cached recipe for a user by its Drive file id. */
export async function getRecipeByFileId(
  db: Database,
  userId: number,
  driveFileId: string,
): Promise<Recipe | undefined> {
  return db.query.recipes.findFirst({
    where: and(
      eq(recipes.user_id, userId),
      eq(recipes.drive_file_id, driveFileId),
    ),
  });
}

/** A recipe that has a source page but names no author. */
export type AuthorlessRecipe = Pick<Recipe, 'drive_file_id' | 'name'>;

/**
 * The next recipes of a person that have a source page but no `>> author:` (or
 * `>> by:`) line, in a stable order (by Drive file id) after `after`, and how
 * many such recipes are left after the last one returned. These are the ones
 * the author can still be looked up for.
 *
 * @param after - The last file id already handled, or '' to start from the beginning.
 * @param limit - The most recipes to return.
 */
export async function listAuthorlessRecipes(
  db: Database,
  userId: number,
  after: string,
  limit: number,
): Promise<{
  readonly rows: readonly AuthorlessRecipe[];
  readonly remaining: number;
}> {
  const wanted = (from: string) =>
    and(
      eq(recipes.user_id, userId),
      isNotNull(recipes.source_url),
      ne(recipes.source_url, ''),
      gt(recipes.drive_file_id, from),
      notLike(recipes.source, '%>> author:%'),
      notLike(recipes.source, '%>> by:%'),
    );
  const rows = await db
    .select({ drive_file_id: recipes.drive_file_id, name: recipes.name })
    .from(recipes)
    .where(wanted(after))
    .orderBy(asc(recipes.drive_file_id))
    .limit(limit);
  const last = rows.at(-1)?.drive_file_id ?? after;
  const [left] = await db
    .select({ n: count() })
    .from(recipes)
    .where(wanted(last));
  return { rows, remaining: left?.n ?? 0 };
}

/** Statements per D1 batch when filling in `source_url` (well under D1's limit). */
const BACKFILL_BATCH = 50;

/**
 * Work out `source_url` for the user's rows that do not have it yet: rows
 * cached before the column existed, or written by the previous release during
 * a deploy. Returns how many rows were filled in, so the caller knows whether
 * an earlier lookup could have missed one. Once a user's rows are all filled in
 * (the steady state) this is one indexed read that finds nothing.
 */
async function backfillSourceUrls(
  db: Database,
  userId: number,
): Promise<number> {
  const legacy = await db
    .select({ id: recipes.drive_file_id, source: recipes.source })
    .from(recipes)
    .where(and(eq(recipes.user_id, userId), isNull(recipes.source_url)));
  const statements = legacy.map((row) =>
    db
      .update(recipes)
      .set({ source_url: indexedSourceUrl(row.source) })
      .where(
        and(eq(recipes.user_id, userId), eq(recipes.drive_file_id, row.id)),
      ),
  );
  for (const [first, ...rest] of chunked(statements, BACKFILL_BATCH)) {
    // `batch` wants at least one statement; a chunk always has one.
    if (first) {
      await db.batch([first, ...rest]);
    }
  }
  return legacy.length;
}

/** The user's recipe whose indexed source address is `sourceUrl`, if any. */
async function recipeWithSourceUrl(
  db: Database,
  userId: number,
  sourceUrl: string,
): Promise<Recipe | undefined> {
  return db.query.recipes.findFirst({
    where: and(eq(recipes.user_id, userId), eq(recipes.source_url, sourceUrl)),
    // Stable when the same link was imported twice: the first by name wins,
    // as it did when this scanned the whole library in name order.
    orderBy: (r, { asc }) => [asc(r.name)],
  });
}

/**
 * Find a cached recipe the user already imported from `url` (matched on the
 * `>> source:` line, ignoring `www.`, query strings and trailing slashes), so a
 * re-import can return the existing recipe instead of saving a duplicate.
 *
 * This is an index lookup on `source_url`, not a scan of the user's library.
 * Rows that predate the column are filled in the first time a lookup misses.
 */
export async function findRecipeBySourceUrl(
  db: Database,
  userId: number,
  url: string,
): Promise<Recipe | undefined> {
  const want = normalizeSourceUrl(url);
  const hit = await recipeWithSourceUrl(db, userId, want);
  if (hit) {
    return hit;
  }
  return (await backfillSourceUrls(db, userId)) > 0
    ? recipeWithSourceUrl(db, userId, want)
    : undefined;
}

/**
 * The cached recipes to drop after a sync: those whose file is no longer in the
 * folder listing (`keep`) AND that the sync did not just touch. A recipe saved
 * while the sync was running is newer than `since` (when the sync began) and
 * so is not in the listing it took earlier; it must not be mistaken for a file
 * deleted in Drive.
 */
export function staleRecipeIds(
  cached: readonly Readonly<{ id: string; seenAt: string }>[],
  keep: ReadonlySet<string>,
  since: string,
): readonly string[] {
  return cached
    .filter((row) => !keep.has(row.id) && row.seenAt < since)
    .map((row) => row.id);
}

/**
 * Drop cached recipes whose Drive file no longer exists in the folder, so a
 * recipe deleted in Drive disappears from the grid instead of lingering. Works
 * out what to drop here and deletes it a few ids at a time (D1 limits the
 * parameters in a statement), and leaves anything newer than `since` alone (see
 * {@link staleRecipeIds}).
 */
export async function deleteRecipesNotIn(
  db: Database,
  userId: number,
  keepFileIds: readonly string[],
  since: string,
): Promise<void> {
  const cached = await db
    .select({ id: recipes.drive_file_id, seenAt: recipes.last_opened_at })
    .from(recipes)
    .where(eq(recipes.user_id, userId));
  const stale = staleRecipeIds(cached, new Set(keepFileIds), since);
  for (const ids of chunked(stale)) {
    await db
      .delete(recipes)
      .where(
        and(eq(recipes.user_id, userId), inArray(recipes.drive_file_id, ids)),
      );
  }
}

/**
 * Forget one recipe everywhere the cache holds it — the recipe row, its
 * embedding and the user's heart — in a single D1 round trip.
 */
export async function deleteRecipeData(
  db: Database,
  userId: number,
  driveFileId: string,
): Promise<void> {
  await db.batch([
    db
      .delete(recipes)
      .where(
        and(
          eq(recipes.user_id, userId),
          eq(recipes.drive_file_id, driveFileId),
        ),
      ),
    db
      .delete(embeddings)
      .where(
        and(
          eq(embeddings.user_id, userId),
          eq(embeddings.drive_file_id, driveFileId),
        ),
      ),
    db
      .delete(favourites)
      .where(
        and(
          eq(favourites.user_id, userId),
          eq(favourites.drive_file_id, driveFileId),
        ),
      ),
  ]);
}
