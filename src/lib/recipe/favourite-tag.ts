/**
 * @packageDocumentation
 *
 * The favourite marker stored *inside* a recipe's `.cook` file, as the metadata
 * line `>> favourite: true`. The favourites table in D1 is what the UI reads, so
 * hearting is instant; this marker mirrors it into the file so the favourite
 * travels with the recipe in Drive and is visible to anything that reads the
 * file (other apps, a future import, an assistant).
 */

import { removeMetadata, upsertMetadata } from './cook-text';

/** The metadata key carrying the favourite marker. */
export const FAVOURITE_KEY = 'favourite';

/** Whether a recipe's source carries the favourite marker. */
export function hasFavouriteTag(source: string): boolean {
  const m = new RegExp(`^>>\\s*${FAVOURITE_KEY}:\\s*(.*)$`, 'im').exec(source);
  return m !== null && /^(true|yes|1)$/i.test(m[1]!.trim());
}

/**
 * Return the source with the favourite marker set or removed. Idempotent, and
 * touches only that one metadata line — the method, notes and cooking log are
 * left exactly as they were.
 */
export function withFavouriteTag(source: string, on: boolean): string {
  return on
    ? upsertMetadata(source, [[FAVOURITE_KEY, 'true']])
    : removeMetadata(source, FAVOURITE_KEY);
}
