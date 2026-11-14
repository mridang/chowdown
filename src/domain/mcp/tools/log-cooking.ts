/**
 * @packageDocumentation
 *
 * `log_cooking`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import {
  cookedOn,
  editRecipe,
  label,
  withRecipe,
} from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  RECIPE_CARD_OUTPUT_SCHEMA,
  RECIPE_REFERENCE,
} from '@/domain/mcp/tools/schemas';
import { appendCookingLog } from '@/lib/cooklang';
import {
  errorResult,
  type JsonSchema,
  McpTool,
  NOT_BLANK,
  textArg,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';

export class LogCookingTool extends McpTool<
  'log_cooking',
  ToolContext,
  ToolContent
> {
  readonly name = 'log_cooking';

  readonly title = 'Log a cook';

  readonly description =
    'Appends a dated cooking-log entry to a saved recipe: a note about a time it was cooked, such as what was changed and how it turned out. The entry is dated today unless `date` says otherwise. Each call adds a new entry.';

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      recipe: {
        ...RECIPE_REFERENCE,
        description:
          'The recipe to add the entry to: its name, or its id from a list result.',
      },
      note: {
        type: 'string',
        minLength: 1,
        maxLength: 5000,
        pattern: NOT_BLANK,
        description: 'What to record about this cook.',
      },
      date: {
        type: 'string',
        maxLength: 10,
        pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
        description:
          'The day it was cooked, as YYYY-MM-DD, for a cook that was not today (default: today). Not in the future.',
      },
    },
    required: ['recipe', 'note'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Logging your cook…', 'Logged');

  readonly annotations: ToolAnnotations = writes();

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    return withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
      const note = textArg(args['note']).trim();
      // The schema refuses a blank note; this keeps an empty line out of the
      // user's file even if a schema is ever loosened.
      if (!note) {
        return errorResult('What should the cooking-log entry say?');
      }
      const when = cookedOn(
        args['date'] === undefined ? undefined : textArg(args['date']),
        new Date(),
      );
      if (!when) {
        return errorResult(
          `\`date\` must be a real day that is not in the future, as YYYY-MM-DD; "${textArg(args['date'])}" is not. Nothing was changed.`,
        );
      }
      return editRecipe(
        ctx,
        file,
        (current) => ({ text: appendCookingLog(current, note, when) }),
        `Logged your note on "${label(file)}".`,
      );
    });
  }
}
