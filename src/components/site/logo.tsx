import Link from 'next/link';
import type { ReactElement } from 'react';

import { BRAND_NAME, BRAND_TAGLINE } from '@/app/_brand';
import { PanIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/**
 * The app's mark: a frying pan, drawn as an outline. It illustrates the
 * not-found and error pages; size it with a class (`size-14`).
 */
export function BrandMark({
  className,
}: Readonly<{ className?: string }>): ReactElement {
  return <PanIcon className={cn('text-flame', className)} strokeWidth={1.25} />;
}

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
        {BRAND_NAME}
      </span>
      <span className="mt-1 block text-[10px] font-semibold tracking-[0.24em] uppercase">
        {BRAND_TAGLINE}
      </span>
    </Link>
  );
}
