/**
 * @packageDocumentation
 *
 * `add_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import {
  label,
  modelBudgetRefusal,
  saveUnlessThere,
} from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  CONTENT_MAX,
  NAME_MAX,
  RECIPE_CARD_OUTPUT_SCHEMA,
} from '@/domain/mcp/tools/schemas';
import {
  type JsonSchema,
  McpTool,
  NOT_BLANK,
  textArg,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';

export class AddRecipeTool extends McpTool<
  'add_recipe',
  ToolContext,
  ToolContent
> {
  readonly name = 'add_recipe';

  readonly title = 'Save a recipe';

  readonly description =
    'Saves a recipe the caller has already written in Cooklang as a new file in the Recipes folder, adding tags (cuisine, diet and so on) to the metadata. Saving the same name and recipe again changes nothing. The server does not fetch URLs: `content` must be the recipe text. Cooklang syntax: metadata as `>> key: value` lines at the top (e.g. `>> servings: 4`), ingredients inline as @name{quantity%unit} (e.g. @flour{200%g}, @eggs{2}), cookware as #item{} (e.g. #pan{}) and timers as ~{10%minutes}. Returns the saved recipe.';

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: NAME_MAX,
        pattern: NOT_BLANK,
        description: 'The recipe name.',
      },
      content: {
        type: 'string',
        minLength: 1,
        maxLength: CONTENT_MAX,
        pattern: NOT_BLANK,
        description: 'The full recipe in Cooklang format. Not a URL.',
      },
    },
    required: ['name', 'content'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Saving the recipe…', 'Saved');

  readonly annotations: ToolAnnotations = writes();

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
    const dish = textArg(args['name']);
    const content = textArg(args['content']);
    return saveUnlessThere(
      ctx,
      dish,
      dish,
      content,
      () => services.tagBestEffort(content, dish),
      (file) => `Saved "${label(file)}".`,
    );
  }
}
