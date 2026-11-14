/**
 * @packageDocumentation
 *
 * `get_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { recipeCardResult, type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
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
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
} from '@/domain/mcp/tools/tool';
import { type JsonSchema } from '@/lib/mcp';

export class GetRecipeTool extends McpTool<'get_recipe'> {
  readonly name = 'get_recipe';

  readonly title = 'Open a recipe';

  readonly description =
    'Returns one saved recipe, identified by name or id: its title, details, ingredients with quantities, method steps and cooking log, as text and as a recipe card.';

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      recipe: {
        ...RECIPE_REFERENCE,
        description:
          'The recipe to open: its name, or its id from a list result.',
      },
    },
    required: ['recipe'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = {
    ...cardMeta('Opening the recipe…', 'Here it is'),
    ...WIDGET_CALLABLE,
  };

  readonly annotations: ToolAnnotations = READS;

  override readonly aliases = { name: 'recipe' };

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
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
