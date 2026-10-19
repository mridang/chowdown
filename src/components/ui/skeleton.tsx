import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** One grey placeholder shape; give it the width and height of what it stands for. */
export function Skeleton({
  tone = 'bar',
  className,
}: {
  /** `bar` for text and controls, `block` for a card or photo (a lighter grey). */
  tone?: 'bar' | 'block';
  className?: string;
}) {
  return (
    <div
      className={cn(
        tone === 'bar' ? 'rounded-control bg-ink/10' : 'rounded-card bg-ink/5',
        className,
      )}
    />
  );
}

/**
 * The frame around a loading placeholder: it pulses (unless the person asked
 * for less motion) and tells assistive technology the page is loading.
 */
export function SkeletonFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('animate-pulse motion-reduce:animate-none', className)}
    >
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}
