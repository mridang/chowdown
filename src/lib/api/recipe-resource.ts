/**
 * @packageDocumentation
 *
 * How a recipe looks on the wire. Property names are snake_case, timestamps end
 * in `_at`, and a value that is absent is simply omitted. A *summary* is what
 * lists carry; the full *recipe* adds the Cooklang source and its parsed parts.
 */

import type { Recipe } from '../db/recipes';
import {
  sourceUrlOf,
  isUncurated,
  recipeDisplayName,
} from '../recipe/cook-text';
import { parseRecipe, type StepToken } from '../recipe/cooklang';
import { extractMedia } from '../recipe/media';
import type { RecipeTags } from '../recipe/tag-index';

/** What list endpoints return for each recipe. */
export interface RecipeSummary {
  id: string;
  title: string;
  source_url?: string;
  cover_url?: string;
  tags: RecipeTags;
  favourite: boolean;
  uncurated: boolean;
  modified_at?: string;
}

/** The full recipe. */
export interface RecipeResource extends RecipeSummary {
  images: string[];
  /** The recipe as Cooklang text — the one writable representation. */
  cooklang: string;
  ingredients: { name: string; quantity?: string }[];
  cookware: string[];
  steps: string[];
}

/** A method step as plain text. */
export function stepText(tokens: StepToken[]): string {
  return tokens
    .map((t) => {
      switch (t.kind) {
        case 'text':
          return t.text;
        case 'timer':
          return t.label;
        default:
          return t.name;
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The summary of a cached recipe row. */
export function recipeSummary(row: Recipe, favourite: boolean): RecipeSummary {
  const parsed = parseRecipe(row.source, row.name);
  const summary: RecipeSummary = {
    id: row.drive_file_id,
    title: row.title || recipeDisplayName(row.name),
    tags: row.tags ? (JSON.parse(row.tags) as RecipeTags) : {},
    favourite,
    uncurated: isUncurated(row.name),
  };
  const sourceUrl = sourceUrlOf(row.source);
  if (sourceUrl) {
    summary.source_url = sourceUrl;
  }
  const cover = extractMedia(parsed).cover;
  if (cover) {
    summary.cover_url = cover;
  }
  if (row.modified_time) {
    summary.modified_at = row.modified_time;
  }
  return summary;
}

/** The full recipe for a cached row. */
export function recipeResource(
  row: Recipe,
  favourite: boolean,
): RecipeResource {
  const parsed = parseRecipe(row.source, row.name);
  const media = extractMedia(parsed);
  return {
    ...recipeSummary(row, favourite),
    images: [...(media.cover ? [media.cover] : []), ...media.rest],
    cooklang: row.source,
    ingredients: parsed.ingredients.map((i) =>
      i.quantity ? { name: i.name, quantity: i.quantity } : { name: i.name },
    ),
    cookware: parsed.cookware,
    steps: parsed.steps.map(stepText),
  };
}
