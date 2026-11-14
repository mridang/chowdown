/**
 * @packageDocumentation
 *
 * `capture_idea`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import { plainTitle } from '@/domain/mcp/tool-text';
import { saveUnlessThere } from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  CONTENT_MAX,
  NAME_MAX,
  RECIPE_CARD_OUTPUT_SCHEMA,
} from '@/domain/mcp/tools/schemas';
import {
  McpTool,
  type ToolAnnotations,
  type ToolArgs,
  writes,
} from '@/domain/mcp/tools/tool';
import { buildStubSource, uncuratedFilename } from '@/lib/cooklang';
import { type JsonSchema, NOT_BLANK, textArg } from '@/lib/mcp';

export class CaptureIdeaTool extends McpTool<'capture_idea'> {
  readonly name = 'capture_idea';

  readonly title = 'Capture a recipe idea';

  readonly description =
    "Saves a placeholder for a recipe to work out later (for example 'paneer ki sabji'): a new file marked as an uncurated idea, holding the original request verbatim and an optional draft.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: NAME_MAX,
        pattern: NOT_BLANK,
        description: 'The dish name to use for the file.',
      },
      prompt: {
        type: 'string',
        minLength: 1,
        maxLength: 20_000,
        pattern: NOT_BLANK,
        description: 'The original request, kept verbatim.',
      },
      draft: {
        type: 'string',
        maxLength: CONTENT_MAX,
        description: 'Optional draft Cooklang recipe.',
      },
    },
    required: ['name', 'prompt'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Saving your idea…', 'Saved');

  readonly annotations: ToolAnnotations = writes();

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
    const ctx = await services.openDrive(user);
    const dish = textArg(args['name']);
    const body = buildStubSource({
      name: dish,
      prompt: textArg(args['prompt']),
      draft: args['draft'] ? textArg(args['draft']) : undefined,
    });
    return saveUnlessThere(
      ctx,
      dish,
      uncuratedFilename(dish),
      body,
      async () => body,
      () => `Saved "${plainTitle(dish)}" as an idea to curate later.`,
    );
  }
}
