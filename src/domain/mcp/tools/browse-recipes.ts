/**
 * @packageDocumentation
 *
 * `browse_recipes`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { runScenario } from '@/domain/mcp/tools/recipe-support';
import {
  FACET_TEXT,
  LIMIT_MAX,
  listMeta,
  OFFSET,
  RECIPE_LIST_OUTPUT_SCHEMA,
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

export class BrowseRecipesTool extends McpTool<
  'browse_recipes',
  ToolContext,
  ToolContent
> {
  readonly name = 'browse_recipes';

  readonly title = 'Browse recipes by cuisine, diet or time';

  readonly description =
    "Filters the user's saved recipes by cuisine, eating style (vegan, vegetarian, pescatarian, non-vegetarian), protein, dietary needs, category, method, difficulty, maximum time, favourites or part of the name. Every filter is optional and they combine. Returns the matching recipes, with their ids, grouped by eating style, 12 at a time; use offset for the next page. list_filters shows which values the collection holds.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      cuisine: {
        ...FACET_TEXT,
        description: "e.g. 'Indian', 'Chinese' (comma-separate several).",
      },
      diet_type: {
        ...FACET_TEXT,
        description:
          "Eating style: 'Vegan', 'Vegetarian', 'Pescatarian' or 'Non-vegetarian' (comma-separate several). Asking for Vegetarian also returns vegan dishes, and Pescatarian also returns vegan and vegetarian ones; Non-vegetarian means meat is wanted. Vegetarian dishes contain no meat or fish; pescatarian ones contain fish but no meat.",
      },
      protein: { ...FACET_TEXT, description: "e.g. 'Chicken', 'Paneer'." },
      dietary_needs: {
        ...FACET_TEXT,
        description: "Dietary needs, e.g. 'Gluten-free', 'Dairy-free'.",
      },
      category: { ...FACET_TEXT, description: "e.g. 'Main', 'Dessert'." },
      method: { ...FACET_TEXT, description: "e.g. 'Baked', 'Grilled'." },
      difficulty: {
        type: 'string',
        maxLength: 20,
        description: 'Easy, Medium or Hard (any capitalisation).',
      },
      max_minutes: {
        type: 'number',
        minimum: 0,
        description: 'Only recipes that take at most this long.',
      },
      favourites_only: {
        type: 'boolean',
        description: 'Only recipes the user has hearted.',
      },
      query: {
        type: 'string',
        maxLength: 200,
        description: 'Text to match in the name.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: LIMIT_MAX,
        description: 'Most results (default 12, at most 50).',
      },
      offset: OFFSET,
    },
  };

  override readonly outputSchema: JsonSchema = RECIPE_LIST_OUTPUT_SCHEMA;

  override readonly meta = listMeta('Browsing your recipes…', 'Here they are');

  readonly annotations: ToolAnnotations = READS;

  override readonly spellings: ArgumentSpellings = {
    aliases: { diet: 'dietary_needs' },
  };

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    return runScenario(user, 'browse_recipes', args, services);
  }
}
