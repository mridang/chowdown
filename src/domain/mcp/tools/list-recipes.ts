/**
 * @packageDocumentation
 *
 * `list_recipes`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { recipeListResult, type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import { listingMessage, pageWindow } from '@/domain/mcp/tools/recipe-support';
import {
  listMeta,
  OFFSET,
  PAGE_DEFAULT,
  PAGE_MAX,
  RECIPE_LIST_OUTPUT_SCHEMA,
  WIDGET_CALLABLE,
} from '@/domain/mcp/tools/schemas';
import {
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
} from '@/domain/mcp/tools/tool';
import { type JsonSchema } from '@/lib/mcp';

export class ListRecipesTool extends McpTool<'list_recipes'> {
  readonly name = 'list_recipes';

  readonly title = 'List my recipes';

  readonly description =
    "Lists the names of the recipes saved in the user's Recipes folder, with their ids, 50 at a time (in name order). When there are more, the result says which offset to ask for next.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: PAGE_MAX,
        description: `Most recipes to return (default ${PAGE_DEFAULT}, at most ${PAGE_MAX}).`,
      },
      offset: OFFSET,
    },
  };

  override readonly outputSchema: JsonSchema = RECIPE_LIST_OUTPUT_SCHEMA;

  override readonly meta = {
    ...listMeta('Listing your recipes…', 'Here they are'),
    ...WIDGET_CALLABLE,
  };

  readonly annotations: ToolAnnotations = READS;

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
    const ctx = await services.openDrive(user);
    const files = await ctx.files.list();
    const { offset, limit } = pageWindow(args, PAGE_DEFAULT, PAGE_MAX);
    const page = files.slice(offset, offset + limit);
    return recipeListResult(
      page,
      listingMessage(files.length, offset, page.length),
    );
  }
}
