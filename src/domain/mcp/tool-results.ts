/**
 * @packageDocumentation
 *
 * What a tool call hands back to the assistant: text for the model to read and,
 * for the tools that show a recipe or a list, the structured data the card or
 * list view draws. The text carries the data too (the recipe's ingredients and
 * steps, the list's names and ids), because a host may show the model only the
 * text. Building these is the same everywhere, so it lives here and the tools
 * in `tool-calls.ts` just pick one.
 */

import {
  convertRecipe,
  extractCookingLogs,
  isUncurated,
  parseRecipe,
  recipeDisplayName,
  type UnitSystem,
} from '@/lib/cooklang';
import type { DriveFile } from '@/lib/google/drive';
import { cardText, listText } from '@/domain/mcp/tool-text';
import {
  CARD_RESOURCE_URI,
  LIST_RESOURCE_URI,
} from '@/domain/mcp/ui-resources';
import type { RecipeCardData, RecipeListData } from '@/domain/mcp/ui-types';

import { textResult, type ToolResult } from '@/lib/mcp';
import type { ToolContent } from '@/domain/mcp/tool-context';

export {
  dataResult,
  errorResult,
  type TextContent,
  textResult,
  type ToolResult,
} from '@/lib/mcp';

/** Metadata keys worth showing in the card's meta row (the rest stay in the file). */
const CARD_META_KEYS: ReadonlySet<string> = new Set([
  'servings',
  'prep',
  'time',
  'cuisine',
  'category',
  'difficulty',
  'diet',
  'protein',
  'method',
]);

export function buildRecipeCardData(
  id: string,
  filename: string,
  source: string,
  system?: UnitSystem,
): RecipeCardData {
  const parsed = parseRecipe(source, filename);
  const recipe = system ? convertRecipe(parsed, system) : parsed;
  const sourceMeta = recipe.metadata.find(([key]) => key === 'source')?.[1];
  return {
    ...recipe,
    metadata: recipe.metadata.filter(([key]) =>
      CARD_META_KEYS.has(key.toLowerCase()),
    ),
    id,
    uncurated: isUncurated(filename),
    source: sourceMeta,
    logs: extractCookingLogs(source),
  };
}

/** Build the list `structuredContent` from a set of Drive files. */
export function buildRecipeListData(
  files: readonly DriveFile[],
  query?: string,
): RecipeListData {
  const recipes = files.map((f) => ({
    id: f.id,
    title: recipeDisplayName(f.name),
    uncurated: isUncurated(f.name),
  }));
  return query ? { recipes, query } : { recipes };
}

/** The sentence, then the data under it (nothing extra when there is none). */
function withBody(message: string, body: string): string {
  return body ? `${message}\n\n${body}` : message;
}

/**
 * A tool result that renders the recipe card. The text is the message followed
 * by the recipe itself (see {@link cardText}); the structured data is the card.
 */
export function recipeCardResult(
  id: string,
  filename: string,
  source: string,
  message: string,
  system?: UnitSystem,
): ToolResult<ToolContent> {
  const card = buildRecipeCardData(id, filename, source, system);
  return {
    ...textResult(withBody(message, cardText(card))),
    structuredContent: card,
    _meta: { 'openai/outputTemplate': CARD_RESOURCE_URI },
  };
}

/**
 * A tool result that renders the recipe list. The text is the message followed
 * by one line per recipe with its id (see {@link listText}), so a model that
 * sees only the text can still read the names and address one exactly.
 */
export function recipeListResult(
  files: readonly DriveFile[],
  message: string,
  query?: string,
): ToolResult<ToolContent> {
  const data = buildRecipeListData(files, query);
  return {
    ...textResult(withBody(message, listText(data.recipes))),
    structuredContent: data,
    _meta: { 'openai/outputTemplate': LIST_RESOURCE_URI },
  };
}

/**
 * Like {@link recipeListResult}, for a `message` that already lists the recipes
 * in its own words (the browse and pantry tools group them and add details), so
 * the text is the message alone.
 */
export function recipeListSummaryResult(
  files: readonly DriveFile[],
  message: string,
): ToolResult<ToolContent> {
  return {
    ...textResult(message),
    structuredContent: buildRecipeListData(files),
    _meta: { 'openai/outputTemplate': LIST_RESOURCE_URI },
  };
}
