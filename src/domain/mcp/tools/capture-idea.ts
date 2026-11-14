/**
 * @packageDocumentation
 *
 * `capture_idea`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { plainTitle } from '@/domain/mcp/tool-text';
import { saveUnlessThere } from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  CONTENT_MAX,
  NAME_MAX,
  RECIPE_CARD_OUTPUT_SCHEMA,
} from '@/domain/mcp/tools/schemas';
import { buildStubSource, uncuratedFilename } from '@/lib/cooklang';
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
import { z } from 'zod';

export class CaptureIdeaTool extends McpTool<
  'capture_idea',
  ToolContext,
  ToolContent
> {
  readonly name = 'capture_idea';

  readonly title = 'Capture a recipe idea';

  readonly description =
    "Saves a placeholder for a recipe to work out later (for example 'paneer ki sabji'): a new file marked as an uncurated idea, holding the original request verbatim and an optional draft.";

  readonly input = z
    .object({
      name: z
        .string()
        .min(1)
        .max(NAME_MAX)
        .regex(new RegExp(NOT_BLANK))
        .describe('The dish name to use for the file.'),
      prompt: z
        .string()
        .min(1)
        .max(20_000)
        .regex(new RegExp(NOT_BLANK))
        .describe('The original request, kept verbatim.'),
      draft: z
        .string()
        .max(CONTENT_MAX)
        .describe('Optional draft Cooklang recipe.')
        .optional(),
    })
    .strict();

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Saving your idea…', 'Saved');

  readonly annotations: ToolAnnotations = writes();

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
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
