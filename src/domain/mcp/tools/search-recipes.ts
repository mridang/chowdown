/**
 * @packageDocumentation
 *
 * `search_recipes`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { recipeListResult } from '@/domain/mcp/tool-results';
import {
  pageWindow,
  searchingMessage,
} from '@/domain/mcp/tools/recipe-support';
import {
  listMeta,
  OFFSET,
  PAGE_DEFAULT,
  PAGE_MAX,
  QUERY,
  RECIPE_LIST_OUTPUT_SCHEMA,
} from '@/domain/mcp/tools/schemas';
import { recipeDisplayName } from '@/lib/cooklang';
import { foldText } from '@/lib/intl';
import {
  type JsonSchema,
  McpTool,
  READS,
  textArg,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';

export class SearchRecipesTool extends McpTool<
  'search_recipes',
  ToolContext,
  ToolContent
> {
  readonly name = 'search_recipes';

  readonly title = 'Search recipes by name';

  readonly description =
    'By name only: finds saved recipes whose name contains the query, ignoring case and accents, 50 at a time. The words of a dish that is not named in it (for example an ingredient) are for find_recipes.';

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { ...QUERY, description: 'Text to match in recipe names.' },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: PAGE_MAX,
        description: `Most recipes to return (default ${PAGE_DEFAULT}, at most ${PAGE_MAX}).`,
      },
      offset: OFFSET,
    },
    required: ['query'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_LIST_OUTPUT_SCHEMA;

  override readonly meta = listMeta('Searching your recipes…', 'Here they are');

  readonly annotations: ToolAnnotations = READS;

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    const queryRaw = textArg(args['query']);
    const query = foldText(queryRaw);
    const listed = await ctx.files.list();
    const hits = listed.filter((f) =>
      foldText(recipeDisplayName(f.name)).includes(query),
    );
    const { offset, limit } = pageWindow(args, PAGE_DEFAULT, PAGE_MAX);
    const page = hits.slice(offset, offset + limit);
    const message = searchingMessage(
      queryRaw,
      hits.length,
      offset,
      page.length,
    );
    return recipeListResult(page, message, queryRaw);
  }
}
