/**
 * @packageDocumentation
 *
 * How a favourite heart looks, kept apart from the components so the live
 * button (a client component) and the decorative badge (a plain server
 * component) share one description of it without either importing the other.
 * Nothing here runs in the browser only, so any component may import it.
 */

import { cn } from '@/components/ui/cn';

/**
 * What every heart *button* adds to its look (the decorative badge leaves it
 * off): it dims while a save is in flight and shows the site's focus ring when
 * reached by keyboard.
 */
export const HEART_BUTTON_BASE = 'disabled:opacity-60 focus-ring';

/**
 * The round white heart laid over a recipe card's photo, as classes. Ember when
 * the recipe is a favourite. Otherwise it is muted, and on a pointer device it
 * stays invisible until the card is hovered or something inside it has focus
 * (touch screens cannot hover, so there it is always visible).
 *
 * It sets no position: the caller places it (for example `absolute top-3
 * right-3`), because where it sits depends on the card around it.
 *
 * @param on Whether the recipe is a favourite.
 */
export function heartOverlayClass(on: boolean): string {
  return cn(
    'grid size-9 place-items-center rounded-full border border-line bg-white transition',
    on
      ? 'text-ember'
      : 'text-muted group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ember [@media(hover:hover)]:opacity-0',
  );
}

/**
 * The outlined "Favourite" button on the recipe page, as classes. A favourite
 * gets a flame border and ember text; otherwise it is a plain field-coloured
 * outline that darkens on hover.
 *
 * @param on Whether the recipe is a favourite.
 */
export function heartLabelledClass(on: boolean): string {
  return cn(
    'inline-flex items-center justify-center gap-2 transition',
    'h-10 rounded-control border bg-white px-4 text-sm font-semibold',
    on ? 'border-flame text-ember' : 'border-field text-ink hover:border-ink',
  );
}
