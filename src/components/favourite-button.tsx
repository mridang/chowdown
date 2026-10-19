'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

import { HeartIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import {
  getFavouriteOverride,
  setFavouriteOverride,
  subscribeFavourites,
} from '@/lib/favourites-store';

// Re-exported so the older import path keeps working.
export { HeartIcon };

/**
 * How the heart is presented:
 *  - `overlay`: a round button laid over a card's image. Hidden until the card
 *    is hovered on a pointer device (always visible on touch screens, and
 *    whenever it is filled).
 *  - `inline`: a small always-visible icon, for list rows.
 *  - `labelled`: an outlined button with the heart and a "Favourite" label, for
 *    the recipe page's action row.
 */
export type FavouriteVariant = 'overlay' | 'inline' | 'labelled';

const BASE =
  'inline-flex items-center justify-center gap-2 transition disabled:opacity-60 focus-ring';

function variantClasses(variant: FavouriteVariant, on: boolean): string {
  switch (variant) {
    case 'overlay':
      return cn(
        'h-9 w-9 rounded-full border border-ink/10 bg-white',
        on
          ? 'text-flame opacity-100'
          : 'text-muted hover:text-flame focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
      );
    case 'inline':
      return cn(
        'h-9 w-9 rounded-full hover:bg-ink/5',
        on ? 'text-flame' : 'text-subtle hover:text-flame',
      );
    case 'labelled':
      return cn(
        'h-10 rounded-control border bg-white px-4 text-sm font-semibold',
        on
          ? 'border-flame text-ember'
          : 'border-ink/25 text-ink hover:border-ink',
      );
  }
}

/**
 * The favourite (heart) toggle, shared by the recipe page and the recipe grid.
 *
 * It is optimistic: the heart flips the moment it is clicked, then the change
 * is saved and rolled back if that fails. State is `override ?? initial`, where
 * the override comes from a small shared store, so the same recipe's heart
 * agrees everywhere in the tab (grid card, list row, a prefetched recipe page)
 * without refetching anything.
 */
export function FavouriteButton({
  recipeId,
  initial,
  variant = 'labelled',
  className = '',
}: {
  recipeId: string;
  /** Whether the recipe is a favourite according to the server. */
  initial: boolean;
  variant?: FavouriteVariant;
  /** Extra classes, typically positioning for the overlay variant. */
  className?: string;
}) {
  const on = useSyncExternalStore(
    subscribeFavourites,
    () => getFavouriteOverride(recipeId) ?? initial,
    () => initial,
  );
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(
    async (event: React.MouseEvent) => {
      // The button can sit over a link; don't navigate when it's clicked.
      event.preventDefault();
      event.stopPropagation();
      const next = !on;
      setFavouriteOverride(recipeId, next); // optimistic
      setBusy(true);
      try {
        // Favouriting creates the resource, un-favouriting deletes it.
        const res = await fetch(
          `/api/users/self/favourite-recipes/${recipeId}`,
          { method: next ? 'PUT' : 'DELETE' },
        );
        if (!res.ok) {
          throw new Error(String(res.status));
        }
        setFavouriteOverride(recipeId, next);
      } catch {
        setFavouriteOverride(recipeId, !next); // roll back
      } finally {
        setBusy(false);
      }
    },
    [on, recipeId],
  );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={
        variant === 'labelled'
          ? undefined
          : on
            ? 'Remove from favourites'
            : 'Add to favourites'
      }
      title={on ? 'Remove from favourites' : 'Add to favourites'}
      className={cn(BASE, variantClasses(variant, on), className)}
    >
      <HeartIcon size="menu" filled={on} />
      {variant === 'labelled' ? (on ? 'Favourited' : 'Favourite') : null}
    </button>
  );
}
