import type { ReactNode } from 'react';

import { CloseIcon } from '../icons';
import { cn } from './cn';

/** A removable active-filter chip. */
export function FilterChip({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-control border-ink/25 hover:border-ink inline-flex h-8 items-center gap-1.5 border bg-white pr-2 pl-3 text-sm font-medium transition"
    >
      {children}
      <CloseIcon className="text-ink/65 h-3.5 w-3.5" />
      <span className="sr-only">Remove filter</span>
    </button>
  );
}

/** A small count badge, e.g. the number of active filters. */
export function CountBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-xs font-semibold text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}
