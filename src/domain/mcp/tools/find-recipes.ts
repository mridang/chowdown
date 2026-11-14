/**
 * @packageDocumentation
 *
 * `find_recipes`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { recipeListResult } from '@/domain/mcp/tool-results';
import { indexingNote } from '@/domain/mcp/tools/recipe-support';
import {
  listMeta,
  QUERY,
  RECIPE_LIST_OUTPUT_SCHEMA,
} from '@/domain/mcp/tools/schemas';
import { topSimilar } from '@/domain/recipe/similar';
import {
  type JsonSchema,
  McpTool,
  READS,
  textArg,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class FindRecipesTool extends McpTool<
  'find_recipes',
  ToolContext,
  ToolContent
> {
  readonly name = 'find_recipes';

  readonly title = 'Search recipes by meaning';

  readonly description =
    "By meaning, not name: ranks the user's saved recipes by what they are about (for example 'something with beef that's quick', 'a vegetarian curry'). Returns the best 8 matches. Recipes that have not been indexed yet are indexed on demand, a limited number per call; the result says when some are still waiting.";

  readonly input = z
    .object({
      query: QUERY.describe('What the user is looking for.'),
    })
    .strict();

  override readonly outputSchema: JsonSchema = RECIPE_LIST_OUTPUT_SCHEMA;

  override readonly meta = listMeta('Searching your recipes…', 'Here they are');

  readonly annotations: ToolAnnotations = READS;

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    const query = textArg(args['query']).trim();
    const files = await ctx.files.list();
    const { rows, waiting } = await services.searchIndex(
      ctx.user,
      files,
      ctx.token,
    );
    const queryVector = await services.embedQuery(query);
    return recipeListResult(
      topSimilar(rows, queryVector, files, 8),
      `Here are recipes matching "${query}".${indexingNote(waiting)}`,
      query,
    );
  }
}
