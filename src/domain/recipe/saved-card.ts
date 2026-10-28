/**
 * @packageDocumentation
 *
 * A just-saved recipe as a card, read from the answer to `POST /api/recipes`.
 * The Add recipes flow shows what it saved with the same cards as the
 * collection. The answer is read as `unknown` and checked, and only the pure
 * card helpers are used, so none of the database or Drive code reaches the
 * browser.
 */

import { domainOf, parseRecipe } from '@/lib/cooklang';
import { minutesOf } from '@/domain/recipe/minutes';
import { cleanTitle, levelOf, toneFor } from '@/domain/recipe/card-style';
import type { CardRecipe } from '@/domain/recipe/card-data';

/** The value if it is text, otherwise nothing. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** The text values of a tag, or none when the tag is absent or malformed. */
function tagValues(tags: unknown, key: string): readonly string[] {
  const values =
    typeof tags === 'object' && tags !== null
      ? (tags as Readonly<Record<string, unknown>>)[key]
      : undefined;
  return Array.isArray(values)
    ? values.filter((v): v is string => typeof v === 'string')
    : [];
}

/** The card for a recipe resource, or nothing when the answer is not one. */
export function savedCard(body: unknown): CardRecipe | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const resource = body as Readonly<Record<string, unknown>>;
  const id = textOf(resource['id']);
  const title = textOf(resource['title']);
  if (!id || !title) {
    return undefined;
  }
  const tags = resource['tags'];
  const parsed = parseRecipe(textOf(resource['cooklang']) ?? '', title);
  const meta = (key: string) =>
    parsed.metadata.find(([k]) => k.toLowerCase() === key)?.[1];
  const servings = Number.parseInt(meta('servings') ?? '', 10);
  const url = textOf(resource['source_url']);
  return {
    id,
    title: cleanTitle(title),
    site: (url && domainOf(url)) || '',
    minutes: minutesOf(meta('time')),
    servings: Number.isFinite(servings) && servings > 0 ? servings : undefined,
    difficulty: levelOf(tagValues(tags, 'difficulty')[0]),
    cuisine: tagValues(tags, 'cuisine')[0] ?? '',
    protein: tagValues(tags, 'protein')[0] ?? '',
    category: tagValues(tags, 'category')[0] ?? '',
    diet: tagValues(tags, 'diet'),
    dietType: tagValues(tags, 'diet_type')[0],
    method: tagValues(tags, 'method'),
    keywords: tagValues(tags, 'keywords'),
    favourite: resource['favourite'] === true,
    ...(resource['uncurated'] === true ? { uncurated: true } : {}),
    tone: toneFor(id),
    cover: textOf(resource['cover_url']),
  };
}
