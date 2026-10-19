'use client';

import type { ReactElement } from 'react';

import { HeartIcon } from '@/components/icons';
import {
  HEART_BUTTON_BASE,
  heartLabelledClass,
  heartOverlayClass,
} from '@/components/recipes/heart-look';
import { useFavourite } from '@/components/recipes/use-favourite';
import { cn } from '@/components/ui/cn';

/**
 * How the heart is presented:
 *  - `overlay`: a round button laid over a recipe card's photo. On a pointer
 *    device it stays hidden until the card is hovered or focused (it is always
 *    visible on touch screens, and whenever the recipe is a favourite).
 *  - `labelled`: an outlined button with the heart and a "Favourite" label, for
 *    the recipe page's action row.
 */
export type FavouriteVariant = 'overlay' | 'labelled';

/**
 * The favourite (heart) toggle, shared by the recipe grid and the recipe page.
 *
 * It saves for real, through the favourites API, and is optimistic: the heart
 * flips the moment it is pressed, then rolls back if the save fails. State is
 * `override ?? initial`, where the override comes from a small shared store, so
 * the same recipe's heart agrees everywhere in the tab (grid card, a
 * prefetched recipe page) without refetching anything.
 *
 * It never stops a click from travelling or cancels its default action, because
 * it is never placed inside a link or another control: on a card it sits beside
 * the card's link (a sibling, so a card stays one link and one button), and on
 * the recipe page it sits in the action row. Keep it that way; a button nested
 * inside a link is invalid HTML.
 */
export function FavouriteButton({
  recipeId,
  initial,
  variant = 'labelled',
  className,
}: Readonly<{
  recipeId: string;
  /** Whether the recipe is a favourite according to the server. */
  initial: boolean;
  variant?: FavouriteVariant;
  /** Extra classes, typically the position for the overlay variant. */
  className?: string;
}>): ReactElement {
  const { on, busy, toggle } = useFavourite(recipeId, initial);
  const label = on ? 'Remove from favourites' : 'Add to favourites';

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={on}
      // The labelled button's visible text is its name; the overlay has only an
      // icon, so it needs an explicit one. Both explain the action on hover.
      aria-label={variant === 'overlay' ? label : undefined}
      title={label}
      className={cn(
        HEART_BUTTON_BASE,
        variant === 'overlay'
          ? cn(heartOverlayClass(on), 'focus-visible:opacity-100')
          : heartLabelledClass(on),
        className,
      )}
    >
      <HeartIcon size="menu" filled={on} />
      {variant === 'labelled' ? (on ? 'Favourited' : 'Favourite') : null}
    </button>
  );
}
