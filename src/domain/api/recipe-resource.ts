/**
 * @packageDocumentation
 *
 * How a recipe looks on the wire. Property names are snake_case, timestamps end
 * in `_at`, and a value that is absent is simply omitted. A *summary* is what
 * lists carry; the full *recipe* adds the Cooklang source and its parsed parts.
 */

import type { Recipe } from '@/domain/db/recipes';
import {
  sourceUrlOf,
  isUncurated,
  recipeDisplayName,
} from '@/lib/cooklang/cook-text';
import { parseRecipe, type StepToken } from '@/lib/cooklang/cooklang';
import { extractMedia } from '@/domain/recipe/media';
import { rowTags, type RecipeTags } from '@/domain/recipe/tag-index';

/** What list endpoints return for each recipe. */
export interface RecipeSummary {
  readonly id: string;
  readonly title: string;
  readonly source_url?: string;
  readonly cover_url?: string;
  readonly tags: RecipeTags;
  readonly favourite: boolean;
  readonly uncurated: boolean;
  readonly modified_at?: string;
}

/** The full recipe. */
export interface RecipeResource extends RecipeSummary {
  readonly images: readonly string[];
  /** The recipe as Cooklang text — the one writable representation. */
  readonly cooklang: string;
  readonly ingredients: readonly {
    readonly name: string;
    readonly quantity?: string;
  }[];
  readonly cookware: readonly string[];
  readonly steps: readonly string[];
}

/** A method step as plain text. */
export function stepText(tokens: readonly StepToken[]): string {
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
export function recipeSummary(
  row: Readonly<Recipe>,
  favourite: boolean,
): RecipeSummary {
  const parsed = parseRecipe(row.source, row.name);
  const sourceUrl = sourceUrlOf(row.source);
  const cover = extractMedia(parsed).cover;
  return {
    id: row.drive_file_id,
    title: row.title || recipeDisplayName(row.name),
    tags: rowTags(row, parsed),
    favourite,
    uncurated: isUncurated(row.name),
    // Absent values are left out of the document altogether.
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    ...(cover ? { cover_url: cover } : {}),
    ...(row.modified_time ? { modified_at: row.modified_time } : {}),
  };
}

/** The full recipe for a cached row. */
export function recipeResource(
  row: Readonly<Recipe>,
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
