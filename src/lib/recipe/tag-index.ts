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

import type { User } from '../db/users';
import { listRecipesByUser, upsertRecipe } from '../db/recipes';
import { getFileContent, type DriveFile } from '../drive/drive-client';
import { getDatabase } from '../util';
import { parseRecipe, type ParsedRecipe } from './cooklang';
import { canonicalValue, facet } from './taxonomy';

/** A recipe's tags as `{ facetKey: canonicalValue[] }`. */
export type RecipeTags = Record<string, string[]>;

/**
 * Pull the curated facet tags out of a parsed recipe's metadata, canonicalised
 * to the vocabulary. Multi-valued facets are comma-split; unknown facet keys
 * and out-of-vocabulary values are dropped.
 */
export function extractFacetTags(recipe: ParsedRecipe): RecipeTags {
  const out: RecipeTags = {};
  for (const [key, value] of recipe.metadata) {
    const f = facet(key.trim().toLowerCase());
    if (!f) {
      continue;
    }
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      const canon = canonicalValue(f.key, part);
      if (!canon) {
        continue;
      }
      const list = (out[f.key] ??= []);
      if (!list.includes(canon)) {
        list.push(canon);
      }
    }
  }
  return out;
}

/** Safely parse a stored tags JSON string back into {@link RecipeTags}. */
function parseStoredTags(json: string | null): RecipeTags | null {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as RecipeTags;
  } catch {
    return null;
  }
}

/**
 * Ensure every file has a current cached tag set and return a map of Drive
 * file id → tags. Reads (and re-parses) only files that are new, changed, or
 * not yet indexed; everything else is served from the D1 cache.
 */
export async function syncRecipeTags(
  user: User,
  files: DriveFile[],
  token: string,
): Promise<Map<string, RecipeTags>> {
  const db = getDatabase();
  const existing = await listRecipesByUser(db, user.id);
  const byId = new Map(existing.map((r) => [r.drive_file_id, r]));
  const result = new Map<string, RecipeTags>();

  for (const file of files) {
    const cached = byId.get(file.id);
    const cachedTags = cached ? parseStoredTags(cached.tags) : null;
    if (
      cached &&
      cachedTags &&
      cached.modified_time === (file.modifiedTime ?? null)
    ) {
      result.set(file.id, cachedTags);
      continue;
    }
    // New, changed, or never-indexed: read and re-extract.
    const source = await getFileContent(file.id, token);
    const parsed = parseRecipe(source, file.name);
    const tags = extractFacetTags(parsed);
    await upsertRecipe(db, {
      user_id: user.id,
      drive_file_id: file.id,
      name: file.name,
      title: parsed.title,
      source,
      modified_time: file.modifiedTime ?? null,
      tags: JSON.stringify(tags),
    });
    result.set(file.id, tags);
  }

  return result;
}
