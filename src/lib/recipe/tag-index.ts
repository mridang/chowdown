/**
 * @packageDocumentation
 *
 * The tag index: keep each recipe's curated taxonomy tags cached in D1 so the
 * app's faceted list can filter and count server-side without re-reading every
 * `.cook` file from Drive on each page load.
 *
 * Like the embedding cache, the sync is lazy and modified-time gated: a file is
 * only re-read and re-parsed when it's new, has changed in Drive, or has never
 * been indexed. Drive stays the source of truth for the recipe list itself —
 * this is purely a tags-by-id lookup.
 */

import type { Database } from '@/lib/db/client';
import type { User } from '@/lib/db/users';
import { listRecipesByUser, upsertRecipe, type Recipe } from '@/lib/db/recipes';
import { getFileContent, type DriveFile } from '@/lib/drive/drive-client';
import { getDatabase, getEnv, runInBackground } from '@/lib/util/runtime';
import { parseRecipe, type ParsedRecipe } from '@/lib/recipe/cooklang';
import { embedRecipe } from '@/lib/recipe/embed-write';
import { mapSequentially } from '@/lib/recipe/map-sequentially';
import { classifyDietType } from '@/lib/recipe/diet-type';
import { canonicalValue, facet } from '@/lib/recipe/taxonomy';

/** A recipe's tags as `{ facetKey: canonicalValue[] }`. */
export type RecipeTags = Readonly<Record<string, readonly string[]>>;

/**
 * The `[facetKey, canonicalValue]` pairs written in a recipe's metadata, in
 * the order they appear. Unknown and derived facets and out-of-vocabulary
 * values are left out; a multi-valued line is split on commas.
 */
function facetPairs(
  metadata: ParsedRecipe['metadata'],
): readonly (readonly [string, string])[] {
  return metadata.flatMap(([key, value]) => {
    const f = facet(key.trim().toLowerCase());
    if (!f || f.derived) {
      return [];
    }
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((part) => {
        const canon = canonicalValue(f.key, part);
        return canon ? [[f.key, canon] as const] : [];
      });
  });
}

/**
 * Pull the curated facet tags out of a parsed recipe's metadata, canonicalised
 * to the vocabulary. Multi-valued facets are comma-split; unknown facet keys
 * and out-of-vocabulary values are dropped.
 */
export function extractFacetTags(recipe: Readonly<ParsedRecipe>): RecipeTags {
  const byFacet = Object.groupBy(facetPairs(recipe.metadata), ([key]) => key);
  const written: RecipeTags = Object.fromEntries(
    Object.entries(byFacet).map(([key, pairs]) => [
      key,
      // A value written twice counts once, keeping the order it first appeared.
      [...new Set((pairs ?? []).map(([, value]) => value))],
    ]),
  );
  const diet = classifyDietType(
    recipe.ingredients.map((i) => i.name),
    written['protein'] ?? [],
  );
  return diet ? { ...written, diet_type: [diet] } : written;
}

/**
 * A cached recipe row's tags as they should be read today: worked out from its
 * source, exactly as indexing does, so the vocabulary and the eating-style
 * rules are always current and a corrupt or out-of-date `tags` column can't
 * leak through. The stored column is only a cache for the sync. Always use this
 * rather than parsing `row.tags`; pass the already-parsed recipe when you have
 * it to save a second parse.
 */
export function rowTags(
  row: Readonly<{ source: string; name: string }>,
  parsed?: Readonly<ParsedRecipe>,
): RecipeTags {
  return extractFacetTags(parsed ?? parseRecipe(row.source, row.name));
}

/**
 * Write (or refresh) one recipe's row in the D1 cache after an app/MCP write to
 * Drive. Keeping `source` and `tags` current here is what lets the recipe page
 * and the `/app` grid render straight from D1 — no live Drive round-trip on the
 * hot path. `modified_time` is left null so the next `/app` sync still does one
 * self-healing re-read if Drive's own timestamp has moved on.
 */
export async function indexRecipeWrite(
  db: Database,
  userId: number,
  driveFileId: string,
  name: string,
  source: string,
  modifiedTime: string | null = null,
  options: Readonly<{ embed?: boolean }> = {},
): Promise<void> {
  const parsed = parseRecipe(source, name);
  await upsertRecipe(db, {
    user_id: userId,
    drive_file_id: driveFileId,
    name,
    title: parsed.title,
    source,
    modified_time: modifiedTime,
    tags: JSON.stringify(extractFacetTags(parsed)),
  });
  // Embed in the background so "find similar" stays current without making the
  // write (or the next page view) wait for the model.
  if (options.embed !== false) {
    runInBackground(
      embedRecipe(
        db,
        getEnv(),
        userId,
        driveFileId,
        name,
        source,
        modifiedTime,
      ),
    );
  }
}

/** Whether a parsed JSON value is a `{ facetKey: string[] }` object. */
function isRecipeTags(value: unknown): value is RecipeTags {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (list) =>
        Array.isArray(list) && list.every((item) => typeof item === 'string'),
    )
  );
}

/** Safely parse a stored tags JSON string back into {@link RecipeTags}. */
function parseStoredTags(json: string | null): RecipeTags | null {
  if (!json) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return isRecipeTags(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Where {@link syncRecipeTags} reads and writes. The default is the real D1
 * database and Google Drive; a test hands in small fakes instead.
 */
export interface TagSyncDeps {
  /** The D1 database holding the recipe cache. */
  readonly database: () => Database;
  /** The user's cached recipe rows. */
  readonly listCached: (
    db: Database,
    userId: number,
  ) => Promise<
    readonly Pick<Recipe, 'drive_file_id' | 'modified_time' | 'tags'>[]
  >;
  /** Download a file's text from Drive. */
  readonly readFile: (fileId: string, token: string) => Promise<string>;
  /** Write one recipe row into the cache. */
  readonly save: (db: Database, row: RecipeRow) => Promise<unknown>;
}

/** The fields {@link upsertRecipe} takes for one cached recipe. */
type RecipeRow = Parameters<typeof upsertRecipe>[1];

/** The real database and Drive. */
const liveSyncDeps: TagSyncDeps = {
  database: getDatabase,
  listCached: listRecipesByUser,
  readFile: getFileContent,
  save: upsertRecipe,
};

/**
 * Ensure every file has a current cached tag set and return a map of Drive
 * file id → tags. Reads (and re-parses) only files that are new, changed, or
 * not yet indexed; everything else is served from the D1 cache.
 *
 * @param deps Where to read and write; leave out for the real thing.
 */
export async function syncRecipeTags(
  user: Readonly<User>,
  files: readonly DriveFile[],
  token: string,
  deps: TagSyncDeps = liveSyncDeps,
): Promise<ReadonlyMap<string, RecipeTags>> {
  const db = deps.database();
  const existing = await deps.listCached(db, user.id);
  const byId = new Map(existing.map((r) => [r.drive_file_id, r]));

  /** The tags of one file: from the cache if it is current, else re-read. */
  const tagsOf = async (
    file: DriveFile,
  ): Promise<readonly [string, RecipeTags]> => {
    const cached = byId.get(file.id);
    const cachedTags = cached ? parseStoredTags(cached.tags) : null;
    if (
      cached &&
      cachedTags &&
      cached.modified_time === (file.modifiedTime ?? null)
    ) {
      return [file.id, cachedTags];
    }
    // New, changed, or never-indexed: read and re-extract.
    const source = await deps.readFile(file.id, token);
    const parsed = parseRecipe(source, file.name);
    const tags = extractFacetTags(parsed);
    await deps.save(db, {
      user_id: user.id,
      drive_file_id: file.id,
      name: file.name,
      title: parsed.title,
      source,
      modified_time: file.modifiedTime ?? null,
      tags: JSON.stringify(tags),
    });
    return [file.id, tags];
  };

  return new Map(await mapSequentially(files, tagsOf));
}
