/**
 * @packageDocumentation
 *
 * A tiny in-memory store of favourite toggles made in this browser tab. The
 * server renders each heart's initial state, but pages are prefetched and kept
 * in Next's client cache, so a heart toggled on the grid would otherwise look
 * stale on an already-prefetched recipe page (and the other way round). Every
 * heart reads `override ?? initial` from here, so they all agree instantly,
 * with no refetch. A full page load starts clean from fresh server data.
 */

/**
 * The store itself. These two collections are the one place this app keeps
 * state outside React, which is the point of the file: everything else here
 * only reads them, or changes them through `set`, `delete` and `clear`.
 */
const overrides = new Map<string, boolean>();
const listeners = new Set<() => void>();

/** Record the latest known favourite state for a recipe and notify hearts. */
export function setFavouriteOverride(id: string, on: boolean): void {
  overrides.set(id, on);
  for (const listener of listeners) {
    listener();
  }
}

/** The override for a recipe, or `undefined` if it hasn't been toggled here. */
export function getFavouriteOverride(id: string): boolean | undefined {
  return overrides.get(id);
}

/** Subscribe to changes; returns the unsubscribe function. */
export function subscribeFavourites(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * How many recipes are favourites right now: the server's list adjusted by any
 * toggles made in this tab, so a counter can update instantly instead of
 * waiting for a reload.
 */
export function liveFavouriteCount(serverIds: readonly string[]): number {
  const server = new Set(serverIds);
  const toggles = [...overrides];
  // A toggle only matters if it disagrees with the server's list: hearting a
  // recipe that is already a favourite, or un-hearting one that is not, adds
  // and removes nothing.
  const added = toggles.filter(([id, on]) => on && !server.has(id)).length;
  const removed = toggles.filter(([id, on]) => !on && server.has(id)).length;
  return server.size + added - removed;
}

/** Forget all overrides (used by tests). */
export function resetFavouriteOverrides(): void {
  overrides.clear();
}
