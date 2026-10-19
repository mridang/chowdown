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
  isUncurated,
  recipeDisplayName,
  extractCookingLogs,
} from '../recipe/cook-text';
import { parseRecipe } from '../recipe/cooklang';
import { convertRecipe, type UnitSystem } from '../recipe/units';
import type { DriveFile } from '../drive/drive-client';
import { cardText, listText } from './tool-text';
import { CARD_RESOURCE_URI, LIST_RESOURCE_URI } from './ui-resources';
import type { RecipeCardData, RecipeListData } from './ui-types';

/** One piece of text in a tool result. */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

/** The result of a `tools/call`, as the protocol wants it. */
export interface ToolResult {
  /** What the model reads. */
  readonly content: readonly TextContent[];
  /** What the card or list view draws, for the tools that have one. */
  readonly structuredContent?: RecipeCardData | RecipeListData;
  /** Tells ChatGPT-style hosts which view template to draw it with. */
  readonly _meta?: Readonly<Record<string, string>>;
  /** True when the call failed in a way the assistant should relay. */
  readonly isError?: boolean;
}

/** A plain-text tool result. */
export function textResult(body: string): ToolResult {
  return { content: [{ type: 'text', text: body }] };
}

/** A plain-text tool result that tells the assistant the call did not work. */
export function errorResult(body: string): ToolResult {
  return { ...textResult(body), isError: true };
}

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

/**
 * Build the card `structuredContent` for a recipe file, converting quantities
 * to the user's preferred measurement system when one is set. The visible meta
 * row is filtered to the useful facets; provenance/media/keywords stay in the
 * file but aren't dumped into the card.
 */
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
): ToolResult {
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
): ToolResult {
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
): ToolResult {
  return {
    ...textResult(message),
    structuredContent: buildRecipeListData(files),
    _meta: { 'openai/outputTemplate': LIST_RESOURCE_URI },
  };
}
