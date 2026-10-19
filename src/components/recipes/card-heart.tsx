'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

import { HeartIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import {
  getFavouriteOverride,
  setFavouriteOverride,
  subscribeFavourites,
} from '@/lib/favourites-store';

/**
 * The heart on a recipe card. It saves for real, through the same favourites
 * API and the same in-tab store as the heart on the recipe page, so the two
 * always agree: it flips the moment it is pressed, then rolls back if the save
 * fails. The card is a link, so the button sits beside it rather than inside.
 *
 * It stays out of the way until the card is hovered or focused, except on touch
 * screens (which cannot hover) and whenever the recipe is already a favourite.
 */
export function CardHeart({
  recipeId,
  initial,
}: {
  recipeId: string;
  /** Whether the recipe is a favourite according to the server. */
  initial: boolean;
}) {
  const on = useSyncExternalStore(
    subscribeFavourites,
    () => getFavouriteOverride(recipeId) ?? initial,
    () => initial,
  );
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    const next = !on;
    setFavouriteOverride(recipeId, next); // optimistic
    setBusy(true);
    try {
      // Favouriting creates the resource, un-favouriting deletes it.
      const res = await fetch(`/api/users/self/favourite-recipes/${recipeId}`, {
        method: next ? 'PUT' : 'DELETE',
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
    } catch {
      setFavouriteOverride(recipeId, !next); // roll back
    } finally {
      setBusy(false);
    }
  }, [on, recipeId]);

  const label = on ? 'Remove from favourites' : 'Add to favourites';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        'border-ink/10 absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full border bg-white transition focus-visible:opacity-100 disabled:opacity-60 focus-ring',
        on
          ? 'text-ember'
          : 'text-muted hover:text-ember [@media(hover:hover)]:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
      )}
    >
      <HeartIcon size="menu" filled={on} />
    </button>
  );
}
