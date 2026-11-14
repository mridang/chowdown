/**
 * @packageDocumentation
 *
 * Every tool this app offers, and the only place that knows the whole set.
 * Adding a tool means writing its class beside this file and adding it to
 * {@link TOOL_REGISTRY}; nothing else has a list to keep in step.
 *
 * The registry holds instances rather than classes so that a lookup hands back
 * something ready to call, and it is declared `as const` so {@link ToolName}
 * stays the union of the real names instead of widening to `string`.
 */

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
import { McpTool } from '@/domain/mcp/tools/tool';

export {
  McpTool,
  READS,
  READS_THE_WEB,
  writes,
  type ToolAnnotations,
  type ToolArgs,
} from '@/domain/mcp/tools/tool';
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
 * Every tool, in the order the catalogue lists them.
 *
 * Declared `as const` so that {@link ToolName} can be read off it, then handed
 * out as a list of plain {@link McpTool}s: callers treat tools uniformly, and
 * the parts a tool may leave out (an output schema) stay optional to them.
 */
const REGISTERED = [
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

/** The name of one of the tools. */
export type ToolName = (typeof REGISTERED)[number]['name'];

/** Every tool, in the order the catalogue lists them. */
export const TOOL_REGISTRY: readonly McpTool<ToolName>[] = REGISTERED;

/** The tool with this name, if there is one. */
export function toolByName(name: string): McpTool<ToolName> | undefined {
  return TOOL_REGISTRY.find((tool) => tool.name === name);
}
