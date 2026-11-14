/**
 * @packageDocumentation
 *
 * `set_recipe_images`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import {
  editRecipe,
  label,
  withRecipe,
} from '@/domain/mcp/tools/recipe-support';
import {
  cardMeta,
  IMAGES_MAX,
  RECIPE_CARD_OUTPUT_SCHEMA,
  RECIPE_REFERENCE,
} from '@/domain/mcp/tools/schemas';
import { validImageUrls, withImages } from '@/domain/recipe/media';
import { removeMetadata } from '@/lib/cooklang';
import {
  errorResult,
  type JsonSchema,
  McpTool,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';

export class SetRecipeImagesTool extends McpTool<
  'set_recipe_images',
  ToolContext,
  ToolContent
> {
  readonly name = 'set_recipe_images';

  readonly title = 'Set recipe images';

  readonly description =
    'Sets the cover image and any extra photos of a saved recipe from http(s) image URLs, cover first, replacing the images it had; or removes all its images when `clear` is true (and no `images` are given). The URLs are stored, not downloaded.';

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      recipe: {
        ...RECIPE_REFERENCE,
        description:
          'The recipe to change: its name, or its id from a list result.',
      },
      images: {
        type: 'array',
        maxItems: IMAGES_MAX,
        items: { type: 'string', maxLength: 2048 },
        description: 'Image URLs (http/https), cover first.',
      },
      clear: {
        type: 'boolean',
        description:
          "true (with no images) to remove the recipe's images instead.",
      },
    },
    required: ['recipe'],
  };

  override readonly outputSchema: JsonSchema = RECIPE_CARD_OUTPUT_SCHEMA;

  override readonly meta = cardMeta('Setting the images…', 'Images set');

  readonly annotations: ToolAnnotations = writes({
    destructive: true,
    idempotent: true,
  });

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const ctx = await services.openDrive(user);
    return withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
      const urls = Array.isArray(args['images'])
        ? args['images'].map(String)
        : [];
      const clear = args['clear'] === true;
      if (clear && urls.length > 0) {
        return errorResult(
          'Pass either `images` to set them or `clear: true` to remove them, not both. Nothing was changed.',
        );
      }
      if (!clear && validImageUrls(urls).length === 0) {
        return errorResult('Pass at least one http(s) image URL in `images`.');
      }
      return editRecipe(
        ctx,
        file,
        (current) => ({
          text: clear
            ? removeMetadata(current, 'images')
            : withImages(current, urls),
        }),
        clear
          ? `Removed the images from "${label(file)}".`
          : `Set the cover for "${label(file)}".`,
      );
    });
  }
}
