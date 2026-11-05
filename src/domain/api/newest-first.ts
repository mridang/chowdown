/**
 * @packageDocumentation
 *
 * The order of a list that is shown newest first, and so how its cursor pages
 * go: a position is the item's timestamp and id, and "after" a position means
 * older than it. Imports and connected apps are listed this way.
 */

import type { CursorPosition } from '@/lib/core/api';

/** Order two positions newest first, ties by id: "after" then means older. */
export function compareNewestFirst(
  a: CursorPosition,
  b: CursorPosition,
): number {
  return a.key === b.key
    ? a.id.localeCompare(b.id)
    : b.key.localeCompare(a.key);
}
