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

import { upsertMetadata } from './cook-text';
import type { ParsedRecipe } from './cooklang';

/** A recipe's media for display. */
export interface RecipeMedia {
  /** The cover image (first image), if any. */
  cover?: string;
  /** Additional images beyond the cover. */
  rest: string[];
  /** A video URL, if any. */
  video?: string;
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
function meta(recipe: ParsedRecipe, key: string): string | undefined {
  return recipe.metadata.find(([k]) => k.toLowerCase() === key)?.[1];
}

/** Metadata keys whose values are media URLs (hidden from the meta text row). */
export const MEDIA_META_KEYS = new Set(['images', 'video']);

/** Extract the gallery media from a parsed recipe's metadata. */
export function extractMedia(recipe: ParsedRecipe): RecipeMedia {
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
  const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
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
export function validImageUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = normalizeImageUrl(raw);
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
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
