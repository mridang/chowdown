/**
 * @packageDocumentation
 *
 * `find_similar`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { recipeListResult } from '@/domain/mcp/tool-results';
import {
  indexingNote,
  label,
  withRecipeIn,
} from '@/domain/mcp/tools/recipe-support';
import {
  listMeta,
  RECIPE_LIST_OUTPUT_SCHEMA,
  RECIPE_REFERENCE,
} from '@/domain/mcp/tools/schemas';
import { parseVector, topSimilar } from '@/domain/recipe/similar';
import {
  type ArgumentSpellings,
  errorResult,
  type JsonSchema,
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class FindSimilarTool extends McpTool<
  'find_similar',
  ToolContext,
  ToolContent
> {
  readonly name = 'find_similar';

  readonly title = 'Find similar recipes';

  readonly description =
    'Finds the saved recipes most similar to a given saved recipe, which is identified by name or id. Returns up to 6, with their ids. Recipes that have not been indexed yet are indexed on demand, a limited number per call.';

  readonly input = z
    .object({
      recipe: RECIPE_REFERENCE.describe(
        'The recipe to find similar ones to: its name, or its id from a list result.',
      ),
    })
    .strict();

  override readonly outputSchema: JsonSchema = RECIPE_LIST_OUTPUT_SCHEMA;

  override readonly meta = listMeta(
    'Finding similar recipes…',
    'Here they are',
  );

  readonly annotations: ToolAnnotations = READS;

  override readonly spellings: ArgumentSpellings = {
    aliases: { name: 'recipe' },
  };

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    const files = await ctx.files.list();
    return withRecipeIn(
      files,
      args['recipe'],
      'recipe',
      'read',
      async (file) => {
        const { rows, waiting } = await services.searchIndex(
          ctx.user,
          files,
          ctx.token,
          file.id,
        );
        const self = rows.find((r) => r.drive_file_id === file.id);
        if (!self) {
          return errorResult('Could not compute similarity for that recipe.');
        }
        return recipeListResult(
          topSimilar(rows, parseVector(self.vector), files, 6, file.id),
          `Recipes similar to "${label(file)}".${indexingNote(waiting)}`,
        );
      },
    );
  }
}
