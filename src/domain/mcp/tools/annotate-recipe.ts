/**
 * @packageDocumentation
 *
 * `annotate_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { errorResult, type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import {
  editRecipe,
  label,
  noteTarget,
  noteTargetProblem,
  withRecipe,
} from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  RECIPE_CARD_OUTPUT_SCHEMA,
  RECIPE_REFERENCE,
} from '@/domain/mcp/tools/schemas';
import {
  McpTool,
  type ToolAnnotations,
  type ToolArgs,
  writes,
} from '@/domain/mcp/tools/tool';
import { appendNote, parseRecipe } from '@/lib/cooklang';
import { type JsonSchema, NOT_BLANK, textArg } from '@/lib/mcp';

export class AnnotateRecipeTool extends McpTool<'annotate_recipe'> {
  readonly name = 'annotate_recipe';

  readonly title = 'Add a note to a recipe';

  readonly description =
    "Adds a personal note to a saved recipe without changing the original text. The note can be attached to one ingredient (`ingredient`), to one step (`step` number), or to the recipe as a whole when both are left out, for example 'use 3 avocados instead of 2'. Each call adds a new note.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      recipe: {
        ...RECIPE_REFERENCE,
        description:
          'The recipe to annotate: its name, or its id from a list result.',
      },
      note: {
        type: 'string',
        minLength: 1,
        maxLength: 5000,
        pattern: NOT_BLANK,
        description: 'The note text.',
      },
      ingredient: {
        type: 'string',
        maxLength: 200,
        description:
          'Attach the note to this ingredient (by name, as it is in the recipe). Not together with `step`.',
      },
      step: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        description:
          'Attach the note to this step (1-based number). Not together with `ingredient`.',
      },
    },
    required: ['recipe', 'note'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Saving your note…', 'Note saved');

  readonly annotations: ToolAnnotations = writes();

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
    const ctx = await services.openDrive(user);
    return withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
      const noteText = textArg(args['note']).trim();
      if (!noteText) {
        return errorResult('What note should I add?');
      }
      const hasIngredient = Boolean(textArg(args['ingredient']).trim());
      if (hasIngredient && args['step'] != null) {
        return errorResult(
          'A note goes in one place: give either `ingredient` or `step`, not both. Nothing was changed.',
        );
      }
      const target = noteTarget(args);
      return editRecipe(
        ctx,
        file,
        (current) => {
          const problem = noteTargetProblem(
            parseRecipe(current, file.name),
            target,
          );
          return problem
            ? { refusal: errorResult(problem) }
            : {
                text: appendNote(current, {
                  scope: target.scope,
                  key: target.key,
                  text: noteText,
                }),
              };
        },
        `Added your note${target.where} to "${label(file)}".`,
      );
    });
  }
}
