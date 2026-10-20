'use client';

import type { ReactElement, ReactNode } from 'react';

import { SlidersIcon } from '@/components/icons';
import { CountBadge } from '@/components/ui/chip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * On phones the filters live in a drawer opened from a "Filters" button, which
 * shows how many are on. From the `md` breakpoint the button is hidden and the
 * panel is laid out in the page instead.
 */
export function FilterDrawer({
  activeCount,
  children,
}: Readonly<{
  /** How many filters are switched on; shown on the button when above zero. */
  activeCount: number;
  /** The filter panel to show inside the drawer. */
  children: ReactNode;
}>): ReactElement {
  return (
    <Dialog>
      <DialogTrigger className="focus-ring-flush flex h-11 w-full items-center justify-between rounded-control border border-field bg-white px-4 text-sm font-semibold outline-none md:hidden">
        <span className="flex items-center gap-2">
          <SlidersIcon size="menu" />
          Filters
        </span>
        {activeCount > 0 ? <CountBadge>{activeCount}</CountBadge> : null}
      </DialogTrigger>
      <DialogContent variant="drawer" closeLabel="Close filters">
        <div className="p-5">
          <DialogTitle className="font-display text-2xl font-semibold">
            Filters
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-subtle">
            Pick as many as you like.
          </DialogDescription>
          <div className="mt-5">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
