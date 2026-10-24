/**
 * @packageDocumentation
 *
 * A saved recipe boiled down to what the pages show on a card, in a filter or
 * in a list: title, photo, source site, time, and the tags that matter. Built
 * from a cached row, so the recipe grid, the home page, the "you might also
 * like" row and the landing page all read recipes the same way.
 */

import type { Recipe } from '@/lib/db/recipes';
import {
  domainOf,
  isUncurated,
  recipeDisplayName,
  sourceUrlOf,
} from '@/lib/recipe/cook-text';
import { parseRecipe } from '@/lib/recipe/cooklang';
import { extractMedia } from '@/lib/recipe/media';
import { minutesOf } from '@/lib/recipe/minutes';
import { rowTags } from '@/lib/recipe/tag-index';

/** A soft colour a recipe without a photo wears instead. */
export type Tone = 'flame' | 'marigold' | 'forest' | 'sand' | 'ink';

/** How hard a recipe is to cook, as the recipe's own `difficulty` tag says. */
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

/** One recipe as the pages show it. Missing facts are empty, never invented. */
export interface CardRecipe {
  readonly id: string;
  readonly title: string;
  /** The site it was saved from, e.g. `seriouseats.com`; empty if typed in. */
  readonly site: string;
  /** Total time, when the recipe says. */
  readonly minutes?: number;
  readonly servings?: number;
  readonly difficulty?: DifficultyLevel;
  readonly cuisine: string;
  readonly protein: string;
  readonly category: string;
  /** Dietary needs such as Gluten-free. */
  readonly diet: readonly string[];
  /** Vegan, vegetarian, pescatarian or non-vegetarian, worked out from the ingredients. */
  readonly dietType?: string;
  readonly method: readonly string[];
  readonly keywords: readonly string[];
  readonly favourite: boolean;
  /** A stub the assistant or user jotted down but never curated (shown as an "idea"). */
  readonly uncurated?: boolean;
  readonly tone: Tone;
  /** A cover photo address; without one the card shows a colour tile. */
  readonly cover?: string;
  /** The recipe's Cooklang source, for pages that show it. */
  readonly cooklang?: string;
}

/** The placeholder colours, in the order a hash picks from them. */
const TONES = ['flame', 'marigold', 'forest', 'sand', 'ink'] as const;

/** A stable tone for a recipe, so its placeholder colour doesn't change. */
export function toneFor(text: string): Tone {
  // A small rolling hash over the characters; kept below 997 so it never
  // outgrows a safe integer however long the text is.
  const hash = [...text].reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) % 997,
    0,
  );
  return TONES.at(hash % TONES.length) ?? TONES[0];
}

/**
 * Tidy a scraped page title for display: sites often append their own name or a
 * tagline ("Chicken Chettinad | Chettinad Chicken Recipe"), so keep the part
 * before the first separator.
 */
export function cleanTitle(title: string): string {
  return (title.split(/\s+[|–—]\s+/)[0] ?? title).trim() || title;
}

/** The difficulty a tag value names, or nothing if it isn't one of the three. */
function levelOf(value: string | undefined): DifficultyLevel | undefined {
  return value === 'Easy' || value === 'Medium' || value === 'Hard'
    ? value
    : undefined;
}

/** A cached row as a card, with the heart state the caller already knows. */
export function toCardRecipe(
  row: Readonly<
    Pick<Recipe, 'drive_file_id' | 'name' | 'source'> & {
      tags?: string | null;
    }
  >,
  favourite: boolean,
  options: Readonly<{ withSource?: boolean }> = {},
): CardRecipe {
  const parsed = parseRecipe(row.source, row.name);
  const tags = rowTags({ source: row.source, name: row.name }, parsed);
  const meta = (key: string) =>
    parsed.metadata.find(([k]) => k.toLowerCase() === key)?.[1];
  const servings = Number.parseInt(meta('servings') ?? '', 10);
  const url = sourceUrlOf(row.source);
  return {
    id: row.drive_file_id,
    // A recipe with no title of its own is named after its file, minus the
    // `.cook` and `[uncurated]` bits.
    title: cleanTitle(recipeDisplayName(parsed.title || row.name)),
    site: (url && domainOf(url)) || '',
    minutes: minutesOf(meta('time')),
    servings: Number.isFinite(servings) && servings > 0 ? servings : undefined,
    difficulty: levelOf(tags['difficulty']?.[0]),
    cuisine: tags['cuisine']?.[0] ?? '',
    protein: tags['protein']?.[0] ?? '',
    category: tags['category']?.[0] ?? '',
    diet: tags['diet'] ?? [],
    dietType: tags['diet_type']?.[0],
    method: tags['method'] ?? [],
    keywords: tags['keywords'] ?? [],
    favourite,
    ...(isUncurated(row.name) ? { uncurated: true } : {}),
    tone: toneFor(row.drive_file_id),
    cover: extractMedia(parsed).cover,
    ...(options.withSource ? { cooklang: row.source } : {}),
  };
}
