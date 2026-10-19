import type { ReactElement } from 'react';

import { HeartIcon } from '@/components/icons';
import { heartOverlayClass } from '@/components/recipes/heart-look';
import { cn } from '@/components/ui/cn';

/**
 * A heart that only decorates: the same round overlay as the live
 * `FavouriteButton`, but not a control. It is hidden from assistive technology
 * and cannot be focused, so a demo card (the landing page's) can show what a
 * favourite looks like without promising a button that does nothing. It is a
 * plain server component; nothing here needs the browser.
 */
export function FavouriteBadge({
  on,
  className,
}: Readonly<{
  /** Whether the recipe is drawn as a favourite. */
  on: boolean;
  /** Extra classes, typically the position over the card's photo. */
  className?: string;
}>): ReactElement {
  return (
    <span aria-hidden="true" className={cn(heartOverlayClass(on), className)}>
      <HeartIcon size="menu" filled={on} />
    </span>
  );
}
