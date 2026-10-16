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

const overrides = new Map<string, boolean>();
const listeners = new Set<() => void>();
/** Bumped on every change, so React can subscribe to "anything changed". */
let version = 0;

/** Record the latest known favourite state for a recipe and notify hearts. */
export function setFavouriteOverride(id: string, on: boolean): void {
  overrides.set(id, on);
  version += 1;
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

/** A number that changes whenever any favourite is toggled in this tab. */
export function getFavouritesVersion(): number {
  return version;
}

/**
 * How many recipes are favourites right now: the server's list adjusted by any
 * toggles made in this tab, so a counter can update instantly instead of
 * waiting for a reload.
 */
export function liveFavouriteCount(serverIds: readonly string[]): number {
  const hearted = new Set(serverIds);
  for (const [id, on] of overrides) {
    if (on) {
      hearted.add(id);
    } else {
      hearted.delete(id);
    }
  }
  return hearted.size;
}

/** Forget all overrides (used by tests). */
export function resetFavouriteOverrides(): void {
  overrides.clear();
  version = 0;
}
