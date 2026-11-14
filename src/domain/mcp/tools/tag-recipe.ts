/**
 * @packageDocumentation
 *
 * `tag_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import {
  editRecipe,
  label,
  modelBudgetRefusal,
  withRecipe,
} from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  RECIPE_CARD_OUTPUT_SCHEMA,
  RECIPE_REFERENCE,
} from '@/domain/mcp/tools/schemas';
import {
  errorResult,
  type JsonSchema,
  McpTool,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';
import { z } from 'zod';

export class TagRecipeTool extends McpTool<
  'tag_recipe',
  ToolContext,
  ToolContent
> {
  readonly name = 'tag_recipe';

  readonly title = 'Tag a recipe';

  readonly description =
    "Classifies a saved recipe by protein, cuisine, course, diet, difficulty, method and keywords, and writes those tags into the recipe, replacing the recipe's existing values for the same keys. If the recipe records a source page and has no image, that page is fetched once to add a cover image.";

  readonly input = z
    .object({
      recipe: RECIPE_REFERENCE.describe(
        'The recipe to tag: its name, or its id from a list result.',
      ),
    })
    .strict();

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Tagging the recipe…', 'Tagged');

  readonly annotations: ToolAnnotations = writes({
    destructive: true,
    openWorld: true,
  });

  override async precheck({
    user,
    services,
  }: ToolContext): Promise<ToolResult<ToolContent> | undefined> {
    return modelBudgetRefusal(user, services);
  }

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    return withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) =>
      editRecipe(
        ctx,
        file,
        async (original) => {
          const { source: tagged, tags } = await services.tag(
            original,
            file.name,
          );
          // Also backfill a missing cover from the recipe's source page.
          const updated = await services.addCover(tagged);
          return tags.length === 0 && updated === original
            ? {
                refusal: errorResult(
                  `Couldn't confidently tag "${label(file)}", so nothing was changed.`,
                ),
              }
            : { text: updated };
        },
        `Tagged "${label(file)}".`,
      ),
    );
  }
}
