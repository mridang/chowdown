/**
 * @packageDocumentation
 *
 * D1 allows only 100 bound parameters in one statement, so a query that lists
 * ids (`id IN (...)`) has to take them a few at a time.
 */

/** How many ids one statement may carry (well under D1's limit of 100). */
export const ID_CHUNK = 50;

/** `items` split into consecutive pieces of at most `size`. */
export function chunked<T>(
  items: readonly T[],
  size: number = ID_CHUNK,
): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, piece) =>
    items.slice(piece * size, (piece + 1) * size),
  );
}
