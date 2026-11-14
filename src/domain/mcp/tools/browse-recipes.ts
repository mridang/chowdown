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
import { z } from 'zod';

export class BrowseRecipesTool extends McpTool<
  'browse_recipes',
  ToolContext,
  ToolContent
> {
  readonly name = 'browse_recipes';

  readonly title = 'Browse recipes by cuisine, diet or time';

  readonly description =
    "Filters the user's saved recipes by cuisine, eating style (vegan, vegetarian, pescatarian, non-vegetarian), protein, dietary needs, category, method, difficulty, maximum time, favourites or part of the name. Every filter is optional and they combine. Returns the matching recipes, with their ids, grouped by eating style, 12 at a time; use offset for the next page. list_filters shows which values the collection holds.";

  readonly input = z
    .object({
      cuisine: FACET_TEXT.describe(
        "e.g. 'Indian', 'Chinese' (comma-separate several).",
      ).optional(),
      diet_type: FACET_TEXT.describe(
        "Eating style: 'Vegan', 'Vegetarian', 'Pescatarian' or 'Non-vegetarian' (comma-separate several). Asking for Vegetarian also returns vegan dishes, and Pescatarian also returns vegan and vegetarian ones; Non-vegetarian means meat is wanted. Vegetarian dishes contain no meat or fish; pescatarian ones contain fish but no meat.",
      ).optional(),
      protein: FACET_TEXT.describe("e.g. 'Chicken', 'Paneer'.").optional(),
      dietary_needs: FACET_TEXT.describe(
        "Dietary needs, e.g. 'Gluten-free', 'Dairy-free'.",
      ).optional(),
      category: FACET_TEXT.describe("e.g. 'Main', 'Dessert'.").optional(),
      method: FACET_TEXT.describe("e.g. 'Baked', 'Grilled'.").optional(),
      difficulty: z
        .string()
        .max(20)
        .describe('Easy, Medium or Hard (any capitalisation).')
        .optional(),
      max_minutes: z
        .number()
        .min(0)
        .describe('Only recipes that take at most this long.')
        .optional(),
      favourites_only: z
        .boolean()
        .describe('Only recipes the user has hearted.')
        .optional(),
      query: z
        .string()
        .max(200)
        .describe('Text to match in the name.')
        .optional(),
      limit: z
        .int()
        .min(1)
        .max(LIMIT_MAX)
        .describe('Most results (default 12, at most 50).')
        .optional(),
      offset: OFFSET,
    })
    .strict();

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
