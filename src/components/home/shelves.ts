/**
 * @packageDocumentation
 *
 * Which of the user's recipes the signed-in home puts in each row. These are
 * plain functions over the collection so the choices can be tested without a
 * page: what counts as "easy and quick", and how the "from the shelf" row varies
 * from day to day without ever being random on each load.
 */

import type { CardRecipe } from '../../lib/recipe/card-data';

/** How many recipes a row shows. */
export const ROW_SIZE = 4;

/** A "quick" recipe takes at most this many minutes. */
export const QUICK_MINUTES = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The number of the current day (UTC), to seed the shelf row. */
export function todaySeed(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS);
}

/** Recipes with a photo first, keeping their order otherwise. */
export function photosFirst(recipes: CardRecipe[]): CardRecipe[] {
  return [
    ...recipes.filter((r) => r.cover),
    ...recipes.filter((r) => !r.cover),
  ];
}

/** Easy recipes that take half an hour or less; ones without a time don't count. */
export function easyAndQuick(recipes: CardRecipe[]): CardRecipe[] {
  return recipes.filter(
    (r) =>
      r.difficulty === 'Easy' &&
      r.minutes !== undefined &&
      r.minutes <= QUICK_MINUTES,
  );
}

/**
 * A few recipes to browse from the whole collection, skipping any already on
 * the page. Which ones changes with `seed` (the day number, say) but is the same
 * for everyone loading the page that day, so it never reshuffles under a reader.
 * Recipes with a photo are preferred, since this row is there to tempt.
 */
export function fromTheShelf(
  recipes: CardRecipe[],
  seed: number,
  skip: ReadonlySet<string> = new Set(),
  size = ROW_SIZE,
): CardRecipe[] {
  const pool = photosFirst(recipes.filter((r) => !skip.has(r.id)));
  const withPhoto = pool.filter((r) => r.cover);
  const from = withPhoto.length >= size ? withPhoto : pool;
  if (from.length <= size) {
    return from;
  }
  // Walk the pool from a seeded start, stepping by a stride that shares no
  // factor with its length so the picks are spread out rather than adjacent.
  let stride = Math.max(2, Math.floor(from.length / size));
  while (gcd(stride, from.length) !== 1) {
    stride += 1;
  }
  const start = ((seed % from.length) + from.length) % from.length;
  return Array.from(
    { length: size },
    (_, i) => from[(start + i * stride) % from.length]!,
  );
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
