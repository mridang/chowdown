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
  getSession,
  getUserAccessToken,
} from '../auth/current-user';
import { DriveNotConnectedError, isDriveConnected } from '../auth/drive-access';
import {
  ENDED_SESSION_PATH,
  sessionIsCurrent,
  type SessionPayload,
} from '../auth/session';
import type { Database } from '../db/client';
import { getRecipePageRows, type RecipePageRows } from '../db/recipe-page';
import { claimDriveSync, type User } from '../db/users';
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
export type DriveLookup =
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
 * What {@link loadRecipePageRows} reaches out to, gathered in one place so a
 * test can hand in small fakes. The default is the real session, database and
 * Drive.
 */
export interface RecipeLoadDeps {
  /** The signed-in session from the cookie, if any. */
  readonly session: () => Promise<SessionPayload | null>;
  /** The D1 database. */
  readonly database: () => Database;
  /** The recipe page's rows, in one round trip. */
  readonly pageRows: (
    db: Database,
    userId: number,
    id: string,
  ) => Promise<RecipePageRows>;
  /** The full signed-in user, for the Drive fallback. */
  readonly currentUser: () => Promise<User | null>;
  /**
   * Take the turn to read Drive for the person; false when a Drive listing
   * started within the last minute, so an id the cache lacks really is
   * unknown rather than just new.
   */
  readonly claimLookup: (db: Database, userId: number) => Promise<boolean>;
  /** Look the recipe up in Drive and index it. */
  readonly lookUp: (
    db: Database,
    uid: number,
    user: Readonly<User>,
    id: string,
  ) => Promise<DriveLookup>;
  /** Send the visitor elsewhere; never returns. */
  readonly redirect: (to: string) => never;
}

/** The real thing. */
const liveDeps: RecipeLoadDeps = {
  session: getSession,
  database: getDatabase,
  pageRows: getRecipePageRows,
  currentUser: getCurrentUser,
  claimLookup: claimDriveSync,
  lookUp: lookUpInDrive,
  redirect,
};

/**
 * The page rows for a recipe, falling back to Drive once when the cache has
 * never seen it. Redirects when there is no way to look (signed out, the
 * session ended, or no Drive connected) and returns null when the recipe can't
 * be found.
 *
 * The Drive fallback lists the whole folder, so it is only taken when the
 * person's last Drive sync started over a minute ago: otherwise the cache is as
 * fresh as Drive would be, the id is simply unknown, and a stranger's
 * made-up ids cannot be used to make us list the folder over and over.
 *
 * @param deps Collaborators; leave out to use the real ones.
 */
export async function loadRecipePageRows(
  id: string,
  deps: RecipeLoadDeps = liveDeps,
): Promise<RecipePageRows | null> {
  const session = (await deps.session()) ?? deps.redirect('/');
  const db = deps.database();
  const cached = await deps.pageRows(db, session.uid, id);
  // The batch carried the account's session epoch, so this check is free.
  if (
    cached.sessionEpoch === undefined ||
    !sessionIsCurrent(session, cached.sessionEpoch)
  ) {
    deps.redirect(ENDED_SESSION_PATH);
  }
  if (cached.recipe) {
    return cached;
  }
  // Cold cache: read from Drive once and index it, then re-read.
  const user = (await deps.currentUser()) ?? deps.redirect('/');
  if (!isDriveConnected(user)) {
    // Nothing cached and no Drive to look in: the list explains how to connect.
    deps.redirect('/app');
  }
  if (!(await deps.claimLookup(db, user.id))) {
    return null;
  }
  const found = await deps.lookUp(db, session.uid, user, id);
  if (found.status === 'lapsed') {
    // Google stopped accepting the login while we looked.
    deps.redirect('/app');
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
    const rows = await loadRecipePageRows(id);
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
