/**
 * @packageDocumentation
 *
 * `favourite_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { textResult, type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import { label, withRecipe } from '@/domain/mcp/tools/recipe-support';
import { RECIPE_REFERENCE } from '@/domain/mcp/tools/schemas';
import {
  McpTool,
  type ToolAnnotations,
  type ToolArgs,
  writes,
} from '@/domain/mcp/tools/tool';
import { type JsonSchema } from '@/lib/mcp';

export class FavouriteRecipeTool extends McpTool<'favourite_recipe'> {
  readonly name = 'favourite_recipe';

  readonly title = 'Favourite a recipe';

  readonly description =
    'Marks a saved recipe as a favourite (a heart), or removes the mark when `favourite` is false.';

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      recipe: {
        ...RECIPE_REFERENCE,
        description:
          'The recipe to heart: its name, or its id from a list result.',
      },
      favourite: {
        type: 'boolean',
        description: 'true to heart (default), false to remove the heart.',
      },
    },
    required: ['recipe'],
  };

  readonly annotations: ToolAnnotations = writes({ idempotent: true });

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
    const ctx = await services.openDrive(user);
    return withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
      const on = args['favourite'] !== false;
      await services.setFavourite(ctx.user.id, file.id, on);
      return textResult(
        on
          ? `Added "${label(file)}" to your favourites.`
          : `Removed "${label(file)}" from your favourites.`,
      );
    });
  }
}
