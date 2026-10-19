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
import { getRecipePageRows, type RecipePageRows } from '../db/recipe-page';
import { setRecipesFolderId } from '../db/users';
import {
  ensureRecipesFolder,
  getFileContent,
  listRecipeFiles,
} from '../drive/drive-client';
import { getDatabase } from '../util';
import { toCardRecipe, toneFor, type CardRecipe, type Tone } from './card-data';
import { extractNotes, sourceUrlOf, type Note } from './cook-text';
import { parseRecipe, type ParsedRecipe } from './cooklang';
import { minutesOf } from './minutes';
import { initialUnits, type UnitChoice } from './page-view';
import { parseSimilar } from './similar';
import { indexRecipeWrite, rowTags, type RecipeTags } from './tag-index';

/** How many "you might also like" recipes the page shows (one full row). */
export const ALSO_LIKE_COUNT = 4;

/** What `loadRecipe` resolves to. */
export interface RecipePageData {
  recipe: ParsedRecipe;
  notes: Note[];
  favourite: boolean;
  /** The recipe's curated tags, worked out from its source. */
  tags: RecipeTags;
  /** Total time in minutes, when the recipe says. */
  minutes?: number;
  /** The address the recipe was saved from, when it has one. */
  sourceUrl?: string;
  /** A soft colour for the photo tile when there is no photo. */
  tone: Tone;
  /** Where the units switch starts (the user's saved preference, if any). */
  units: UnitChoice;
  /** Similar recipes, best first, ready to render as cards. */
  similar: CardRecipe[];
}

/**
 * Turn the batch's similar-recipe rows into cards, in the stored order.
 *
 * The similar list is stored best first; the batch returns its rows in any
 * order, so they are lined up with the list. Ids in the list that have no row
 * (a recipe deleted since) are skipped, and at most `limit` cards come back.
 */
export function similarCards(
  rows: Pick<
    RecipePageRows,
    'similarJson' | 'similarRecipes' | 'similarFavouriteIds'
  >,
  limit: number = ALSO_LIKE_COUNT,
): CardRecipe[] {
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
    const uid = await getSessionUid();
    if (uid === null) {
      redirect('/');
    }
    const db = getDatabase();

    let rows = await getRecipePageRows(db, uid, id);
    if (!rows.recipe) {
      // Cold cache: read from Drive once and index it, then re-read. (The
      // redirects sit outside the try, which would otherwise swallow them.)
      const user = await getCurrentUser();
      if (!user) {
        redirect('/');
      }
      if (!isDriveConnected(user)) {
        // Nothing cached and no Drive to look in: the list explains how to connect.
        redirect('/app');
      }
      let lapsed = false;
      try {
        const token = await getUserAccessToken(user);
        const folderId =
          user.recipes_folder_id ?? (await ensureRecipesFolder(token));
        if (!user.recipes_folder_id) {
          await setRecipesFolderId(db, user.id, folderId);
        }
        const files = await listRecipeFiles(folderId, token);
        const file = files.find((f) => f.id === id);
        if (!file) {
          return null;
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
        rows = await getRecipePageRows(db, uid, id);
      } catch (error) {
        if (!(error instanceof DriveNotConnectedError)) {
          return null;
        }
        lapsed = true;
      }
      if (lapsed) {
        // Google stopped accepting the login while we looked.
        redirect('/app');
      }
    }
    if (!rows.recipe) {
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
