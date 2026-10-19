/**
 * @packageDocumentation
 *
 * The user's recipes as MCP resources, one per recipe at `recipe://<id>` (the
 * id is the Google Drive file id, the same one tools show in their lists). A
 * host can attach a recipe to a conversation as context without a tool call.
 * The resource is the recipe's Cooklang source, read from the user's Drive
 * when it is asked for. The set of recipes differs for every user, so the
 * server lists the template (`recipe://{id}`) rather than every recipe, and a
 * read is cached only for the person who made it.
 */

import { DriveNotConnectedError } from '../auth/drive-access';
import type { User } from '../db/users';
import { ERROR_INTERNAL, ERROR_INVALID_PARAMS, RpcError } from './protocol';
import { createToolContext, type ToolContext } from './tool-calls';

/** The scheme and separator every recipe address starts with. */
export const RECIPE_URI_PREFIX = 'recipe://';

/** The resource template `resources/templates/list` returns. */
export const RECIPE_TEMPLATE = {
  uriTemplate: `${RECIPE_URI_PREFIX}{id}`,
  name: 'recipe',
  title: 'A recipe',
  description:
    "One of the user's recipes, as its Cooklang source. The id is the one find_recipes, browse_recipes and the other list tools show next to each recipe.",
  mimeType: 'text/plain',
} as const;

/** Whether `uri` is a recipe address (and so is read from Drive rather than served from memory). */
export function isRecipeUri(uri: string): boolean {
  return uri.startsWith(RECIPE_URI_PREFIX);
}

/** The recipe id in a recipe address, or `undefined` when there is none. */
function recipeIdOf(uri: string): string | undefined {
  const id = uri.slice(RECIPE_URI_PREFIX.length);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : undefined;
}

/**
 * Read one recipe.
 *
 * @param user - Whose Drive to read.
 * @param uri - A `recipe://<id>` address.
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
    throw new RpcError(ERROR_INVALID_PARAMS, 'Resource not found', { uri });
  }
  try {
    const ctx = await openContext(user);
    const files = await ctx.files.list();
    if (!files.some((file) => file.id === id)) {
      throw new RpcError(ERROR_INVALID_PARAMS, 'Resource not found', { uri });
    }
    return {
      contents: [
        {
          uri,
          mimeType: RECIPE_TEMPLATE.mimeType,
          text: await ctx.files.read(id),
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
