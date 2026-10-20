import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { CloseIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import { PillLink } from '@/components/ui/pill';

/** An active-filter chip; following it removes that filter. */
export function FilterChip({
  href,
  children,
}: Readonly<{
  /** The same page with this filter taken out of the address. */
  href: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex h-8 items-center gap-1.5 rounded-control border border-field bg-white pr-2 pl-3 text-sm font-medium transition hover:border-ink"
    >
      {children}
      <CloseIcon size="compact" className="text-subtle" />
      <span className="sr-only">Remove filter</span>
    </Link>
  );
}

/** A small count badge, e.g. the number of active filters. */
export function CountBadge({
  children,
  className,
}: Readonly<{
  children: ReactNode;
  className?: string;
}>): ReactElement {
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

/** A plain tag, e.g. a keyword on a recipe. */
export function Tag({
  href,
  children,
}: Readonly<{ href: string; children: ReactNode }>): ReactElement {
  return (
    <PillLink href={href} variant="plain" size="sm">
      {children}
    </PillLink>
  );
}
