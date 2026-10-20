import Link from 'next/link';
import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * The wordmark: a heavy heading face, lower case, with a small descriptor
 * beneath, linking home. Used in the site header and, scaled up, the footer.
 */
export function Logo({
  className,
}: Readonly<{ className?: string }>): ReactElement {
  return (
    <Link
      href="/"
      className={cn('inline-block leading-none text-ink', className)}
    >
      <span className="block font-display text-[1.7rem] font-bold tracking-tight">
        chowdown
      </span>
      <span className="mt-1 block text-[10px] font-semibold tracking-[0.24em] uppercase">
        Recipe keeper
      </span>
    </Link>
  );
}
