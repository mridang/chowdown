'use client';

import { useSyncExternalStore } from 'react';

import { HeartIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import { ToggleLink } from '@/components/ui/toggle-link';
import {
  liveFavouriteCount,
  subscribeFavourites,
} from '@/lib/favourites-store';

/**
 * The Favourites switch above the filters: a toggle that follows `href` and
 * shows how many recipes are favourites right now. The count starts from the
 * server's list and moves the instant a heart is pressed anywhere in this tab.
 */
export function FavouritesLink({
  href,
  active,
  serverIds,
}: {
  href: string;
  active: boolean;
  /** The recipes that are favourites according to the server. */
  serverIds: string[];
}) {
  const count = useSyncExternalStore(
    subscribeFavourites,
    () => liveFavouriteCount(serverIds),
    () => serverIds.length,
  );
  return (
    <ToggleLink
      href={href}
      active={active}
      activeText="on"
      className={cn(
        'rounded-control flex h-10 w-full items-center justify-between px-3.5 text-sm font-semibold transition focus-ring',
        active ? 'bg-ink text-white' : 'bg-marigold hover:bg-marigold/85',
      )}
    >
      <span className="flex items-center gap-2">
        <HeartIcon size="sm" filled={active} />
        Favourites
      </span>
      <span className="tabular-nums">{count}</span>
    </ToggleLink>
  );
}
