/**
 * @packageDocumentation
 *
 * `import_recipe`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { recipeCardResult } from '@/domain/mcp/tool-results';
import { plainTitle } from '@/domain/mcp/tool-text';
import { modelBudgetRefusal } from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  CONTENT_MAX,
  IMAGES_MAX,
  NAME_MAX,
  RECIPE_CARD_OUTPUT_SCHEMA,
  WEB_URL,
} from '@/domain/mcp/tools/schemas';
import { importRecipe } from '@/domain/recipe/import-recipe';
import { recipeDisplayName } from '@/lib/cooklang';
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
import { z } from 'zod';

export class ImportRecipeTool extends McpTool<
  'import_recipe',
  ToolContext,
  ToolContent
> {
  readonly name = 'import_recipe';

  readonly title = 'Import a recipe from a web page';

  readonly description =
    "Creates a saved recipe from the content of a web page that the caller has already fetched: pass the recipe's text as `content` (not a URL), meaning its title, ingredients and steps, or the page's JSON-LD `Recipe` block; the rest of the page is not needed. The server converts it to Cooklang, tags it and saves it in the Recipes folder. If `url` is given it is recorded as the recipe's source, a link that was already imported is not imported twice, and the page is fetched once to look for images. Returns the saved recipe.";

  readonly input = z
    .object({
      content: z
        .string()
        .min(1)
        .max(CONTENT_MAX)
        .regex(new RegExp(NOT_BLANK))
        .describe(
          "The recipe's text (title, ingredients, steps) or the page's JSON-LD Recipe block; page text or HTML also works, but only the first 12,000 characters are read unless a JSON-LD Recipe is present. Never a URL.",
        ),
      url: WEB_URL.describe(
        'The source page URL (http or https), for attribution.',
      ).optional(),
      name: z
        .string()
        .max(NAME_MAX)
        .describe('Optional recipe name; inferred from the content if omitted.')
        .optional(),
      images: z
        .array(z.string().max(2048))
        .max(IMAGES_MAX)
        .describe(
          'Image URLs from the page (the og:image or the recipe photo), cover first. Used as the recipe images; the server cannot always fetch the page itself.',
        )
        .optional(),
    })
    .strict();

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Importing the recipe…', 'Imported');

  readonly annotations: ToolAnnotations = writes({ openWorld: true });

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
    const content = textArg(args['content']);
    const outcome = await importRecipe(
      {
        findExisting: (url) => services.findImported(ctx.user.id, url),
        convert: services.convertImport,
        tag: services.tagBestEffort,
        create: ctx.files.create,
        update: ctx.files.update,
        index: ctx.files.index,
      },
      {
        content,
        url: args['url'] ? textArg(args['url']) : undefined,
        name: args['name'] ? textArg(args['name']) : undefined,
        images: Array.isArray(args['images'])
          ? args['images'].map(String)
          : undefined,
      },
    );
    if (outcome.kind === 'refused') {
      return errorResult(
        "That content didn't contain a recipe (no ingredients or steps), so nothing was saved. " +
          'Open the page, copy the actual recipe text, and call import_recipe again with it as `content`.',
      );
    }
    const name = plainTitle(recipeDisplayName(outcome.name));
    let message: string;
    if (outcome.kind === 'existing') {
      message = `"${name}" is already in your recipes.`;
    } else if (outcome.kind === 'repaired') {
      message = `Repaired "${name}" — the earlier import had no ingredients or steps.`;
    } else {
      message = `Imported "${name}".`;
    }
    return recipeCardResult(
      outcome.id,
      outcome.name,
      outcome.source,
      message,
      ctx.system,
    );
  }
}
