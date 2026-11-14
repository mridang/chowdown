/**
 * @packageDocumentation
 *
 * `get_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { recipeCardResult } from '@/domain/mcp/tool-results';
import {
  alsoMatchingNote,
  label,
  withRecipe,
} from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  RECIPE_CARD_OUTPUT_SCHEMA,
  RECIPE_REFERENCE,
  WIDGET_CALLABLE,
} from '@/domain/mcp/tools/schemas';
import {
  type ArgumentSpellings,
  type JsonSchema,
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class GetRecipeTool extends McpTool<
  'get_recipe',
  ToolContext,
  ToolContent
> {
  readonly name = 'get_recipe';

  readonly title = 'Open a recipe';

  readonly description =
    'Returns one saved recipe, identified by name or id: its title, details, ingredients with quantities, method steps and cooking log, as text and as a recipe card.';

  readonly input = z
    .object({
      recipe: RECIPE_REFERENCE.describe(
        'The recipe to open: its name, or its id from a list result.',
      ),
    })
    .strict();

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = {
    ...cardMeta('Opening the recipe…', 'Here it is'),
    ...WIDGET_CALLABLE,
  };

  readonly annotations: ToolAnnotations = READS;

  override readonly spellings: ArgumentSpellings = {
    aliases: { name: 'recipe' },
  };

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    return withRecipe(
      ctx,
      args['recipe'],
      'recipe',
      'read',
      async (file, others) =>
        recipeCardResult(
          file.id,
          file.name,
          await ctx.files.read(file.id),
          `Showing the "${label(file)}" recipe.${alsoMatchingNote(args['recipe'], others)}`,
          ctx.system,
        ),
    );
  }
}
