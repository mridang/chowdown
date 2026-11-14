/**
 * @packageDocumentation
 *
 * `favourite_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { label, withRecipe } from '@/domain/mcp/tools/recipe-support';
import { RECIPE_REFERENCE } from '@/domain/mcp/tools/schemas';
import {
  McpTool,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';
import { z } from 'zod';

export class FavouriteRecipeTool extends McpTool<
  'favourite_recipe',
  ToolContext,
  ToolContent
> {
  readonly name = 'favourite_recipe';

  readonly title = 'Favourite a recipe';

  readonly description =
    'Marks a saved recipe as a favourite (a heart), or removes the mark when `favourite` is false.';

  readonly input = z
    .object({
      recipe: RECIPE_REFERENCE.describe(
        'The recipe to heart: its name, or its id from a list result.',
      ),
      favourite: z
        .boolean()
        .describe('true to heart (default), false to remove the heart.')
        .optional(),
    })
    .strict();

  readonly annotations: ToolAnnotations = writes({ idempotent: true });

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
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
