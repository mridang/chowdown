import { useCallback, useState, useSyncExternalStore } from 'react';

import {
  getFavouriteOverride,
  setFavouriteOverride,
  subscribeFavourites,
} from '@/lib/favourites-store';

/** The part of `fetch` this file uses, so a test can stand in for the network. */
type Send = (
  input: string,
  init: { method: 'PUT' | 'DELETE' },
) => Promise<{ ok: boolean; status: number }>;

/** Where a recipe's favourite flag lives on the API. */
export function favouriteUrl(recipeId: string): string {
  return `/api/users/self/favourite-recipes/${recipeId}`;
}

/**
 * Save a favourite change **optimistically**: the shared store flips at once so
 * every heart in the tab agrees, then the change is sent, and the store is put
 * back if the save fails. Favouriting creates the resource (`PUT`) and
 * un-favouriting deletes it (`DELETE`).
 *
 * Resolves to whether the save went through; it never rejects.
 */
export async function saveFavourite(
  recipeId: string,
  next: boolean,
  send: Send = fetch,
): Promise<boolean> {
  setFavouriteOverride(recipeId, next); // optimistic
  try {
    const res = await send(favouriteUrl(recipeId), {
      method: next ? 'PUT' : 'DELETE',
    });
    if (!res.ok) {
      throw new Error(String(res.status));
    }
    return true;
  } catch {
    setFavouriteOverride(recipeId, !next); // roll back
    return false;
  }
}

/** What {@link useFavourite} hands back to a heart. */
export interface Favourite {
  /** Whether the recipe is a favourite right now (including an unsaved change). */
  readonly on: boolean;
  /** Whether a save is in flight. */
  readonly busy: boolean;
  /** Flip the favourite; resolves once the save has finished. */
  readonly toggle: () => Promise<void>;
}

/**
 * The state and action behind a favourite (heart) button, shared by the heart
 * on a recipe card and the one on the recipe page.
 *
 * `on` is `override ?? initial`: the override comes from a small shared store,
 * so the same recipe's heart agrees everywhere in the tab (grid card, list row,
 * a prefetched recipe page) without refetching anything. `busy` is true while a
 * save is in flight, so the button can be disabled against double presses.
 */
export function useFavourite(recipeId: string, initial: boolean): Favourite {
  const on = useSyncExternalStore(
    subscribeFavourites,
    () => getFavouriteOverride(recipeId) ?? initial,
    () => initial,
  );
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      await saveFavourite(recipeId, !on);
    } finally {
      setBusy(false);
    }
  }, [on, recipeId]);

  return { on, busy, toggle };
}
