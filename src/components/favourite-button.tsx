'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

import {
  getFavouriteOverride,
  setFavouriteOverride,
  subscribeFavourites,
} from '@/lib/favourites-store';

/** The heart glyph: an outline, or filled when the recipe is a favourite. */
export function HeartIcon({
  filled,
  className = 'h-4 w-4',
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

/**
 * How the heart is presented:
 *  - `overlay`: a round button laid over a card's image. Hidden until the card
 *    is hovered (always visible on touch screens, and whenever it's filled).
 *  - `inline`: a small always-visible icon, for list rows.
 *  - `labelled`: icon plus a "Favourite" label, for the recipe page header.
 */
export type FavouriteVariant = 'overlay' | 'inline' | 'labelled';

const BASE =
  'inline-flex items-center justify-center gap-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-60';

function variantClasses(variant: FavouriteVariant, on: boolean): string {
  switch (variant) {
    case 'overlay':
      return [
        'h-8 w-8 rounded-full bg-white/90 shadow-sm backdrop-blur',
        on
          ? 'text-rose-600 opacity-100'
          : 'text-slate-600 opacity-0 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
      ].join(' ');
    case 'inline':
      return [
        'h-8 w-8 rounded-full hover:bg-slate-100',
        on ? 'text-rose-600' : 'text-slate-400 hover:text-rose-600',
      ].join(' ');
    case 'labelled':
      return [
        'rounded-md border px-3 py-1.5 text-sm font-medium',
        on
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
      ].join(' ');
  }
}

/**
 * The favourite (heart) toggle, shared by the recipe page and the recipe grid.
 *
 * It is optimistic — the heart flips the moment it is clicked, then the change
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
        const res = await fetch(`/api/recipes/${recipeId}/favourite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: next }),
        });
        if (!res.ok) {
          throw new Error(String(res.status));
        }
        const data = (await res.json()) as { favourite: boolean };
        setFavouriteOverride(recipeId, data.favourite);
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
      aria-label={on ? 'Remove from favourites' : 'Add to favourites'}
      title={on ? 'Remove from favourites' : 'Add to favourites'}
      className={`${BASE} ${variantClasses(variant, on)} ${className}`}
    >
      <HeartIcon
        filled={on}
        className={variant === 'labelled' ? 'h-4 w-4' : 'h-[18px] w-[18px]'}
      />
      {variant === 'labelled' ? (on ? 'Favourited' : 'Favourite') : null}
    </button>
  );
}
