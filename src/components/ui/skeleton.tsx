import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** One grey placeholder shape; give it the width and height of what it stands for. */
export function Skeleton({
  tone = 'bar',
  shape = 'rounded',
  className,
}: {
  /** `bar` for text and controls, `block` for a card or photo (a lighter grey). */
  tone?: 'bar' | 'block';
  /**
   * The corners: `rounded` is the usual softened rectangle, `square` has none
   * (a photo), `circle` is round (an avatar, a step number).
   */
  shape?: 'rounded' | 'square' | 'circle';
  className?: string;
}) {
  const colour = tone === 'bar' ? 'bg-ink/10' : 'bg-ink/5';
  const corners =
    shape === 'square'
      ? ''
      : shape === 'circle'
        ? 'rounded-full'
        : tone === 'bar'
          ? 'rounded-control'
          : 'rounded-card';
  return <div className={cn(colour, corners, className)} />;
}

/**
 * The frame around a loading placeholder: it pulses (unless the person asked
 * for less motion) and tells assistive technology the page is loading.
 */
export function SkeletonFrame({
  label = 'Loading',
  className,
  children,
}: {
  /** What assistive technology announces, e.g. "Loading your recipes". */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('animate-pulse motion-reduce:animate-none', className)}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
