/**
 * @packageDocumentation
 *
 * Every tool this app offers. Adding one means writing its class beside this
 * file and naming it here; nothing else holds a list to keep in step.
 */

import { ToolRegistry, type NameOf } from '@/lib/mcp';
import type { ToolContent, ToolContext } from '@/domain/mcp/tool-context';
import { ListRecipesTool } from '@/domain/mcp/tools/list-recipes';
import { BrowseRecipesTool } from '@/domain/mcp/tools/browse-recipes';
import { RecipesFromIngredientsTool } from '@/domain/mcp/tools/recipes-from-ingredients';
import { ListFiltersTool } from '@/domain/mcp/tools/list-filters';
import { SearchRecipesTool } from '@/domain/mcp/tools/search-recipes';
import { FindRecipesTool } from '@/domain/mcp/tools/find-recipes';
import { FindSimilarTool } from '@/domain/mcp/tools/find-similar';
import { GetRecipeTool } from '@/domain/mcp/tools/get-recipe';
import { ImportRecipeTool } from '@/domain/mcp/tools/import-recipe';
import { AddRecipeTool } from '@/domain/mcp/tools/add-recipe';
import { CaptureIdeaTool } from '@/domain/mcp/tools/capture-idea';
import { LogCookingTool } from '@/domain/mcp/tools/log-cooking';
import { SetMeasurementSystemTool } from '@/domain/mcp/tools/set-measurement-system';
import { FavouriteRecipeTool } from '@/domain/mcp/tools/favourite-recipe';
import { TagRecipeTool } from '@/domain/mcp/tools/tag-recipe';
import { SetRecipeImagesTool } from '@/domain/mcp/tools/set-recipe-images';
import { AnnotateRecipeTool } from '@/domain/mcp/tools/annotate-recipe';

export { ListRecipesTool } from '@/domain/mcp/tools/list-recipes';
export { BrowseRecipesTool } from '@/domain/mcp/tools/browse-recipes';
export { RecipesFromIngredientsTool } from '@/domain/mcp/tools/recipes-from-ingredients';
export { ListFiltersTool } from '@/domain/mcp/tools/list-filters';
export { SearchRecipesTool } from '@/domain/mcp/tools/search-recipes';
export { FindRecipesTool } from '@/domain/mcp/tools/find-recipes';
export { FindSimilarTool } from '@/domain/mcp/tools/find-similar';
export { GetRecipeTool } from '@/domain/mcp/tools/get-recipe';
export { ImportRecipeTool } from '@/domain/mcp/tools/import-recipe';
export { AddRecipeTool } from '@/domain/mcp/tools/add-recipe';
export { CaptureIdeaTool } from '@/domain/mcp/tools/capture-idea';
export { LogCookingTool } from '@/domain/mcp/tools/log-cooking';
export { SetMeasurementSystemTool } from '@/domain/mcp/tools/set-measurement-system';
export { FavouriteRecipeTool } from '@/domain/mcp/tools/favourite-recipe';
export { TagRecipeTool } from '@/domain/mcp/tools/tag-recipe';
export { SetRecipeImagesTool } from '@/domain/mcp/tools/set-recipe-images';
export { AnnotateRecipeTool } from '@/domain/mcp/tools/annotate-recipe';

/**
 * Every tool, in the order the catalogue lists them. Declared `as const` so
 * that {@link ToolName} is the union of the real names rather than `string`.
 */
const TOOLS = [
  new ListRecipesTool(),
  new BrowseRecipesTool(),
  new RecipesFromIngredientsTool(),
  new ListFiltersTool(),
  new SearchRecipesTool(),
  new FindRecipesTool(),
  new FindSimilarTool(),
  new GetRecipeTool(),
  new ImportRecipeTool(),
  new AddRecipeTool(),
  new CaptureIdeaTool(),
  new LogCookingTool(),
  new SetMeasurementSystemTool(),
  new FavouriteRecipeTool(),
  new TagRecipeTool(),
  new SetRecipeImagesTool(),
  new AnnotateRecipeTool(),
] as const;

/** The name of one of this app's tools. */
export type ToolName = NameOf<typeof TOOLS>;

/** Every tool this app offers, looked up by name. */
export const TOOL_REGISTRY = new ToolRegistry<
  ToolName,
  ToolContext,
  ToolContent
>(TOOLS);
