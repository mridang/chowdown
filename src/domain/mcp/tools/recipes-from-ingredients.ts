/**
 * @packageDocumentation
 *
 * `recipes_from_ingredients`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import { runScenario } from '@/domain/mcp/tools/recipe-support';
import {
  FACET_TEXT,
  LIMIT_MAX,
  listMeta,
  OFFSET,
  RECIPE_LIST_OUTPUT_SCHEMA,
} from '@/domain/mcp/tools/schemas';
import {
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
} from '@/domain/mcp/tools/tool';
import { type JsonSchema } from '@/lib/mcp';

export class RecipesFromIngredientsTool extends McpTool<'recipes_from_ingredients'> {
  readonly name = 'recipes_from_ingredients';

  readonly title = 'Find recipes from ingredients';

  readonly description =
    "Matches the user's saved recipes against ingredients they have, with amounts when known (for example '3 tomatoes', '400 g pasta'). Returns recipes that can be made now and recipes that are only a few ingredients short, saying exactly what is missing or needs more of. Salt, pepper, water and cooking oil are assumed to be on hand unless assume_staples is false.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      ingredients: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: { type: 'string', minLength: 1, maxLength: 300 },
        description:
          "What they have, with amounts when known, e.g. ['3 tomatoes', '400 g pasta', 'garlic'].",
      },
      allow_missing: {
        type: 'integer',
        minimum: 0,
        maximum: 20,
        description:
          'How many ingredients a recipe may lack to still be listed as almost there (default 2; 0 for only what can be made now).',
      },
      assume_staples: {
        type: 'boolean',
        description: 'Assume salt, pepper, water and oil (default true).',
      },
      diet_type: {
        ...FACET_TEXT,
        description:
          "Only recipes that suit this eating style, e.g. 'Vegetarian' (which also allows vegan dishes). Comma-separate several.",
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: LIMIT_MAX,
        description: 'Most results per list (default 12, at most 50).',
      },
      offset: OFFSET,
    },
    required: ['ingredients'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_LIST_OUTPUT_SCHEMA;

  override readonly meta = listMeta(
    'Matching your ingredients…',
    'Here is what fits',
  );

  readonly annotations: ToolAnnotations = READS;

  override readonly listsOfText = ['ingredients'];

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
    return runScenario(user, 'recipes_from_ingredients', args, services);
  }
}
