/**
 * @packageDocumentation
 *
 * Loads everything the recipe page shows for one recipe. It lives here, not in
 * the page file, so the page stays a short composition of sections and the
 * redirect-and-fallback logic has one home.
 */

import { redirect } from 'next/navigation';
import { cache } from 'react';

import {
  getCurrentUser,
  getSessionUid,
  getUserAccessToken,
} from '../auth/current-user';
import { DriveNotConnectedError, isDriveConnected } from '../auth/drive-access';
import type { Database } from '../db/client';
import { getRecipePageRows, type RecipePageRows } from '../db/recipe-page';
import type { User } from '../db/users';
import { getFileContent, listRecipeFiles } from '../drive/drive-client';
import { getDatabase } from '../util';
import { toCardRecipe, toneFor, type CardRecipe, type Tone } from './card-data';
import { extractNotes, sourceUrlOf, type Note } from './cook-text';
import { parseRecipe, type ParsedRecipe } from './cooklang';
import { recipesFolderOf } from './drive-sync';
import { minutesOf } from './minutes';
import { initialUnits, type UnitChoice } from './page-view';
import { parseSimilar } from './similar';
import { indexRecipeWrite, rowTags, type RecipeTags } from './tag-index';

/** How many "you might also like" recipes the page shows (one full row). */
export const ALSO_LIKE_COUNT = 4;

/** What `loadRecipe` resolves to. */
export interface RecipePageData {
  readonly recipe: ParsedRecipe;
  readonly notes: readonly Note[];
  readonly favourite: boolean;
  /** The recipe's curated tags, worked out from its source. */
  readonly tags: RecipeTags;
  /** Total time in minutes, when the recipe says. */
  readonly minutes?: number;
  /** The address the recipe was saved from, when it has one. */
  readonly sourceUrl?: string;
  /** A soft colour for the photo tile when there is no photo. */
  readonly tone: Tone;
  /** Where the units switch starts (the user's saved preference, if any). */
  readonly units: UnitChoice;
  /** Similar recipes, best first, ready to render as cards. */
  readonly similar: readonly CardRecipe[];
}

/**
 * Turn the batch's similar-recipe rows into cards, in the stored order.
 *
 * The similar list is stored best first; the batch returns its rows in any
 * order, so they are lined up with the list. Ids in the list that have no row
 * (a recipe deleted since) are skipped, and at most `limit` cards come back.
 */
export function similarCards(
  rows: Readonly<
    Pick<
      RecipePageRows,
      'similarJson' | 'similarRecipes' | 'similarFavouriteIds'
    >
  >,
  limit: number = ALSO_LIKE_COUNT,
): readonly CardRecipe[] {
  const similarById = new Map(
    rows.similarRecipes.map((row) => [row.drive_file_id, row]),
  );
  const hearted = new Set(rows.similarFavouriteIds);
  return parseSimilar(rows.similarJson)
    .flatMap((s) => {
      const row = similarById.get(s.id);
      return row ? [toCardRecipe(row, hearted.has(s.id))] : [];
    })
    .slice(0, limit);
}

/** What reading a recipe the cache didn't have from Drive came to. */
type DriveLookup =
  | { readonly status: 'loaded'; readonly rows: RecipePageRows }
  /** Not in Drive either, or Drive failed for a passing reason. */
  | { readonly status: 'missing' }
  /** Google stopped accepting the login while we looked. */
  | { readonly status: 'lapsed' };

/**
 * Read one recipe the cache has never seen from Drive, index it so the next
 * view is fast, and re-read the page rows. (The redirects stay with the
 * caller: a redirect thrown inside a `try` would be swallowed.)
 */
async function lookUpInDrive(
  db: Database,
  uid: number,
  user: Readonly<User>,
  id: string,
): Promise<DriveLookup> {
  try {
    const token = await getUserAccessToken(user);
    const folderId = await recipesFolderOf(db, user, token);
    const files = await listRecipeFiles(folderId, token);
    const file = files.find((f) => f.id === id);
    if (!file) {
      return { status: 'missing' };
    }
    const source = await getFileContent(file.id, token);
    await indexRecipeWrite(
      db,
      user.id,
      id,
      file.name,
      source,
      file.modifiedTime ?? null,
    );
    return { status: 'loaded', rows: await getRecipePageRows(db, uid, id) };
  } catch (error) {
    return error instanceof DriveNotConnectedError
      ? { status: 'lapsed' }
      : { status: 'missing' };
  }
}

/**
 * The page rows for a recipe, falling back to Drive once when the cache has
 * never seen it. Redirects when there is no way to look (signed out, or no
 * Drive connected) and returns null when the recipe can't be found.
 */
async function pageRowsFor(
  db: Database,
  uid: number,
  id: string,
): Promise<RecipePageRows | null> {
  const cached = await getRecipePageRows(db, uid, id);
  if (cached.recipe) {
    return cached;
  }
  // Cold cache: read from Drive once and index it, then re-read.
  const user = (await getCurrentUser()) ?? redirect('/');
  if (!isDriveConnected(user)) {
    // Nothing cached and no Drive to look in: the list explains how to connect.
    redirect('/app');
  }
  const found = await lookUpInDrive(db, uid, user, id);
  if (found.status === 'lapsed') {
    // Google stopped accepting the login while we looked.
    redirect('/app');
  }
  return found.status === 'loaded' ? found.rows : null;
}

/**
 * Load one recipe for the page — **in a single D1 round trip**, with no Google
 * or Drive call. The user id comes from the signed session cookie (no `users`
 * lookup), and the recipe, favourite flag, precomputed similar list (with the
 * similar recipes' own rows) and the unit preference are fetched together as
 * one batch. D1 sits in one region, so each extra query from the Worker costs a
 * long round trip; collapsing them into one is what keeps the page fast.
 *
 * Only a recipe that isn't in the cache yet (never seen by `/app` or the MCP)
 * falls back to Drive once, and is indexed so the next view is fast.
 *
 * Wrapped in React `cache()` so the page body and `generateMetadata` share one
 * result per request.
 */
export const loadRecipe = cache(
  async (id: string): Promise<RecipePageData | null> => {
    const uid = (await getSessionUid()) ?? redirect('/');
    const rows = await pageRowsFor(getDatabase(), uid, id);
    if (!rows?.recipe) {
      return null;
    }

    const recipe = parseRecipe(rows.recipe.source, rows.recipe.name);
    const time = recipe.metadata.find(([k]) => k.toLowerCase() === 'time')?.[1];

    return {
      recipe,
      notes: extractNotes(rows.recipe.source),
      favourite: rows.favourite,
      tags: rowTags(rows.recipe, recipe),
      minutes: minutesOf(time),
      sourceUrl: sourceUrlOf(rows.recipe.source),
      tone: toneFor(id),
      units: initialUnits(rows.units),
      similar: similarCards(rows),
    };
  },
);
