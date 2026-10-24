/**
 * @packageDocumentation
 *
 * The user's recipes as MCP resources, one per recipe at `recipe:///<id>` (the
 * id is the Google Drive file id, the same one tools show in their lists). A
 * host can attach a recipe to a conversation as context without a tool call.
 * The resource is the recipe's Cooklang source, read from the user's Drive
 * when it is asked for. `resources/list` lists the recipes (a page at a time,
 * from the cache in the database, which is cheap), and the template
 * (`recipe:///{id}`) says how to build the address of one from an id a tool
 * printed. A read is cached only for the person who made it.
 *
 * The id sits in the path, after an empty authority (`recipe:///`), and not
 * right after the two slashes: that spot is a host name, which RFC 3986 says is
 * case-insensitive and which URI libraries are free to lower-case, and a Drive
 * id is case-sensitive (`1A2b` is not `1a2b`). The earlier form, `recipe://<id>`,
 * is still read, and an id whose case was lost on the way is matched anyway
 * when only one recipe could mean it.
 */

import { asc, eq } from 'drizzle-orm';

import { DriveNotConnectedError } from '@/lib/auth/drive-access';
import type { Database } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import type { User } from '@/lib/db/users';
import { recipeDisplayName } from '@/lib/recipe/cook-text';
import { getDatabase } from '@/lib/util/runtime';
import {
  ERROR_INTERNAL,
  ERROR_INVALID_PARAMS,
  RpcError,
} from '@/lib/mcp/protocol';
import { createToolContext, type ToolContext } from '@/lib/mcp/tool-calls';
import { guarded } from '@/lib/mcp/tool-services';
import { plainTitle } from '@/lib/mcp/tool-text';

/** What every recipe address starts with: the scheme and the two slashes. */
export const RECIPE_URI_PREFIX = 'recipe://';

/** Where the id goes in an address: after an empty authority, so the id is a path. */
const RECIPE_URI_BASE = `${RECIPE_URI_PREFIX}/`;

/** The resource template `resources/templates/list` returns. */
export const RECIPE_TEMPLATE = {
  uriTemplate: `${RECIPE_URI_BASE}{id}`,
  name: 'recipe',
  title: 'A recipe',
  description:
    "One of the user's recipes, as its Cooklang source. The id is the one the list tools (list_recipes, browse_recipes, find_recipes and the others) show next to each recipe; resources/list also lists the recipes.",
  mimeType: 'text/plain',
} as const;

/** The address of the recipe with this Drive file id. */
export function recipeUri(id: string): string {
  return `${RECIPE_URI_BASE}${id}`;
}

/** Whether `uri` is a recipe address (and so is read from Drive rather than served from memory). */
export function isRecipeUri(uri: string): boolean {
  return uri.startsWith(RECIPE_URI_PREFIX);
}

/**
 * The recipe id in a recipe address, or `undefined` when there is none. Both
 * the current form (`recipe:///<id>`) and the earlier one (`recipe://<id>`) are
 * understood.
 */
function recipeIdOf(uri: string): string | undefined {
  const id = uri.startsWith(RECIPE_URI_BASE)
    ? uri.slice(RECIPE_URI_BASE.length)
    : uri.slice(RECIPE_URI_PREFIX.length);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : undefined;
}

/** How much of an address an error repeats; a client may send a megabyte of it. */
const URI_ECHO_LIMIT = 200;

/** The refusal for an address that names no recipe the user has. */
function notFound(uri: string): RpcError {
  return new RpcError(ERROR_INVALID_PARAMS, 'Resource not found', {
    uri: uri.slice(0, URI_ECHO_LIMIT),
  });
}

/**
 * The file an id stands for: the exact id, or, when the exact id is not there,
 * the one file whose id differs only in letter case (an address that a client
 * normalised on the way). Two such files would make the address ambiguous, so
 * then there is none.
 */
function fileFor<T extends { readonly id: string }>(
  files: readonly T[],
  id: string,
): T | undefined {
  const exact = files.find((file) => file.id === id);
  if (exact) {
    return exact;
  }
  const folded = files.filter(
    (file) => file.id.toLowerCase() === id.toLowerCase(),
  );
  return folded.length === 1 ? folded[0] : undefined;
}

/**
 * Read one recipe.
 *
 * @param user - Whose Drive to read.
 * @param uri - A `recipe:///<id>` address (or the earlier `recipe://<id>`).
 * @param openContext - How Drive is opened; leave out for the real one.
 * @returns The resource contents, in the shape `resources/read` returns.
 * @throws {RpcError} `-32602` if the address names no recipe the user has, and
 *   an internal error saying how to connect Drive if they have not.
 */
export async function readRecipeResource(
  user: Readonly<User>,
  uri: string,
  openContext: (
    user: Readonly<User>,
  ) => Promise<ToolContext> = createToolContext,
): Promise<{ readonly contents: readonly object[] }> {
  const id = recipeIdOf(uri);
  if (!id) {
    throw notFound(uri);
  }
  try {
    const ctx = await openContext(user);
    const file = fileFor(await ctx.files.list(), id);
    if (!file) {
      throw notFound(uri);
    }
    return {
      contents: [
        {
          uri,
          mimeType: RECIPE_TEMPLATE.mimeType,
          text: await ctx.files.read(file.id),
        },
      ],
    };
  } catch (error) {
    if (error instanceof DriveNotConnectedError) {
      throw new RpcError(
        ERROR_INTERNAL,
        "Google Drive isn't connected to chowdown yet, so there are no recipes to reach. Ask the user to connect it from chowdown's account menu.",
      );
    }
    throw error;
  }
}

/** A recipe as `resources/list` shows it. */
export interface RecipeEntry {
  /** The Drive file id. */
  readonly id: string;
  /** The file name, e.g. `Pancakes.cook`. */
  readonly name: string;
}

/**
 * How `resources/list` finds a user's recipes: `limit` of them in name order,
 * starting after the first `offset`. The real one asks the database; a test
 * passes its own.
 */
export type RecipeLister = (
  user: Readonly<User>,
  offset: number,
  limit: number,
) => Promise<readonly RecipeEntry[]>;

/**
 * A {@link RecipeLister} over the cached recipes in `database`: a page of the
 * user's recipes, read with a query that fetches only the id and name (not each
 * recipe's full text), in an order that does not change between pages. An empty
 * cache (the web app never opened, nothing synced) lists nothing; the tools fill
 * it when they are used.
 *
 * @param database Where the cache is; a function so it is looked up per call.
 */
export function cachedRecipeLister(database: () => Database): RecipeLister {
  return (user, offset, limit) =>
    guarded('the recipe database', () =>
      database()
        .select({ id: recipes.drive_file_id, name: recipes.name })
        .from(recipes)
        .where(eq(recipes.user_id, user.id))
        .orderBy(asc(recipes.name), asc(recipes.drive_file_id))
        .limit(limit)
        .offset(offset),
    );
}

/** The real {@link RecipeLister}, over the production database. */
export const listCachedRecipes: RecipeLister = cachedRecipeLister(getDatabase);

/** One recipe as an entry of `resources/list`. */
export function recipeResource(entry: RecipeEntry): object {
  return {
    uri: recipeUri(entry.id),
    name: plainTitle(recipeDisplayName(entry.name)),
    mimeType: RECIPE_TEMPLATE.mimeType,
  };
}
