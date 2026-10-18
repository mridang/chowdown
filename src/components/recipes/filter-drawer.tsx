'use client';

import type { ReactNode } from 'react';

import { SlidersIcon } from '@/components/icons';
import { CountBadge } from '@/components/ui/chip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/** On phones the filters live in a drawer opened from a button. */
export function FilterDrawer({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger className="rounded-control border-ink/20 focus-visible:outline-ink flex h-11 w-full items-center justify-between border bg-white px-4 text-sm font-semibold outline-none focus-visible:outline-2 md:hidden">
        <span className="flex items-center gap-2">
          <SlidersIcon className="h-[18px] w-[18px]" />
          Filters
        </span>
        {activeCount > 0 ? <CountBadge>{activeCount}</CountBadge> : null}
      </DialogTrigger>
      <DialogContent variant="drawer" closeLabel="Close filters">
        <div className="p-5">
          <DialogTitle className="font-display text-2xl font-semibold">
            Filters
          </DialogTitle>
          <DialogDescription className="text-ink/65 mt-1 text-sm">
            Pick as many as you like.
          </DialogDescription>
          <div className="mt-5">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
