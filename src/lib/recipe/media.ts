/**
 * @packageDocumentation
 *
 * Read a recipe's media (images, video) out of its metadata. Imports capture
 * `>> images: url, url, …` and `>> video: url` (see import-schema-org), and
 * this turns those back into a structured gallery the recipe page renders: the
 * first image is treated as the cover, the rest as additional shots.
 *
 * Pure and URL-validating — anything that isn't an http(s) URL is dropped, so a
 * malformed metadata value can never inject a bad `src`.
 */

import { upsertMetadata } from '@/lib/cooklang/cook-text';
import type { ParsedRecipe } from '@/lib/cooklang/cooklang';

/** A recipe's media for display. */
export interface RecipeMedia {
  /** The cover image (first image), if any. */
  readonly cover?: string;
  /** Additional images beyond the cover. */
  readonly rest: readonly string[];
  /** A video URL, if any. */
  readonly video?: string;
}

/** True for a well-formed http(s) URL. */
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Read a single metadata value by key (case-insensitive). */
function meta(recipe: Readonly<ParsedRecipe>, key: string): string | undefined {
  return recipe.metadata.find(([k]) => k.toLowerCase() === key)?.[1];
}

/** Metadata keys whose values are media URLs (hidden from the meta text row). */
export const MEDIA_META_KEYS: ReadonlySet<string> = new Set([
  'images',
  'video',
]);

/** Extract the gallery media from a parsed recipe's metadata. */
export function extractMedia(recipe: Readonly<ParsedRecipe>): RecipeMedia {
  // Split on whitespace, not commas: image URLs commonly contain commas (e.g.
  // a `?resize=440,400` query), but never spaces, so whitespace is safe.
  const images = (meta(recipe, 'images') ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => isHttpUrl(s));
  const videoRaw = meta(recipe, 'video')?.trim();
  const video = videoRaw && isHttpUrl(videoRaw) ? videoRaw : undefined;
  return {
    cover: images[0],
    rest: images.slice(1),
    video,
  };
}

/**
 * Normalise one image URL, or return `undefined` if it isn't usable. Must be
 * http(s); spaces and other unsafe characters are percent-encoded (the list is
 * stored space-separated, so a raw space would split one URL into two); and a
 * URL whose last path segment is a placeholder like `undefined` — what a buggy
 * scraper produces when a page has no image — is rejected.
 */
export function normalizeImageUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return undefined;
  }
  const url = new URL(trimmed);
  const last = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  if (/^(undefined|null|nan|false)$/i.test(last)) {
    return undefined;
  }
  return url.href;
}

/**
 * Keep only the usable, distinct image URLs from a list, normalised and in
 * order. Anything else (relative paths, `javascript:` URIs, placeholders) is
 * dropped.
 */
export function validImageUrls(urls: readonly string[]): readonly string[] {
  const usable = urls.flatMap((raw) => {
    const url = normalizeImageUrl(raw);
    return url ? [url] : [];
  });
  // A Set keeps the first occurrence of each address, in order.
  return [...new Set(usable)];
}

/**
 * Set a recipe's `>> images:` metadata (space-separated, first is the cover),
 * replacing any existing value. Returns the source unchanged when none of the
 * given URLs are valid, so a bad call can never blank out an existing cover.
 */
export function withImages(source: string, urls: readonly string[]): string {
  const valid = validImageUrls(urls);
  return valid.length === 0
    ? source
    : upsertMetadata(source, [['images', valid.join(' ')]]);
}
