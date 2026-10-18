/**
 * @packageDocumentation
 *
 * A saved recipe boiled down to what the pages show on a card, in a filter or
 * in a list: title, photo, source site, time, and the tags that matter. Built
 * from a cached row, so the recipe grid, the home page, the "you might also
 * like" row and the landing page all read recipes the same way.
 */

import type { Recipe } from '../db/recipes';
import {
  domainOf,
  isUncurated,
  recipeDisplayName,
  sourceUrlOf,
} from './cook-text';
import { parseRecipe } from './cooklang';
import { extractMedia } from './media';
import { minutesOf } from './minutes';
import { rowTags } from './tag-index';

/** A soft colour a recipe without a photo wears instead. */
export type Tone = 'flame' | 'marigold' | 'forest' | 'sand' | 'ink';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

/** One recipe as the pages show it. Missing facts are empty, never invented. */
export interface CardRecipe {
  id: string;
  title: string;
  /** The site it was saved from, e.g. `seriouseats.com`; empty if typed in. */
  site: string;
  /** Total time, when the recipe says. */
  minutes?: number;
  servings?: number;
  difficulty?: DifficultyLevel;
  cuisine: string;
  protein: string;
  category: string;
  /** Dietary needs such as Gluten-free. */
  diet: string[];
  /** Vegan, vegetarian, pescatarian or non-vegetarian, worked out from the ingredients. */
  dietType?: string;
  method: string[];
  keywords: string[];
  favourite: boolean;
  /** A stub the assistant or user jotted down but never curated (shown as an "idea"). */
  uncurated?: boolean;
  tone: Tone;
  /** A cover photo address; without one the card shows a colour tile. */
  cover?: string;
  /** The recipe's Cooklang source, for pages that show it. */
  cooklang?: string;
}

const TONES: Tone[] = ['flame', 'marigold', 'forest', 'sand', 'ink'];

/** A stable tone for a recipe, so its placeholder colour doesn't change. */
export function toneFor(text: string): Tone {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return TONES[hash % TONES.length]!;
}

/**
 * Tidy a scraped page title for display: sites often append their own name or a
 * tagline ("Chicken Chettinad | Chettinad Chicken Recipe"), so keep the part
 * before the first separator.
 */
export function cleanTitle(title: string): string {
  return title.split(/\s+[|–—]\s+/)[0]!.trim() || title;
}

function levelOf(value: string | undefined): DifficultyLevel | undefined {
  return value === 'Easy' || value === 'Medium' || value === 'Hard'
    ? value
    : undefined;
}

/** A cached row as a card, with the heart state the caller already knows. */
export function toCardRecipe(
  row: Pick<Recipe, 'drive_file_id' | 'name' | 'source'> & {
    tags?: string | null;
  },
  favourite: boolean,
  options: { withSource?: boolean } = {},
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
