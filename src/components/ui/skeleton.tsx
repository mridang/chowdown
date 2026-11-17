import { cn } from '@/components/ui/cn';
import type { ReactElement, ReactNode } from 'react';

/** The rounding class for a placeholder's corners. */
function roundingOf(
  corners: 'rounded' | 'square' | 'circle',
  tone: 'bar' | 'block',
): string {
  if (corners === 'square') {
    return '';
  }
  if (corners === 'circle') {
    return 'rounded-full';
  }
  return tone === 'bar' ? 'rounded-control' : 'rounded-card';
}

/** One grey placeholder shape; give it the width and height of what it stands for. */
export function Skeleton({
  tone = 'bar',
  corners = 'rounded',
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className,
}: Readonly<{
  /** `bar` for text and controls, `block` for a card or photo (a lighter grey). */
  tone?: 'bar' | 'block';

  /**
   * The corners: `rounded` is the usual softened rectangle, `square` has none
   * (a photo), `circle` is round (an avatar, a step number).
   */
  corners?: 'rounded' | 'square' | 'circle';
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className?: string;
}>): ReactElement {
  const colour = tone === 'bar' ? 'bg-ink/10' : 'bg-ink/5';
  const rounding = roundingOf(corners, tone);
  return <div className={cn(colour, rounding, className)} />;
}

/**
 * The frame around a loading placeholder: it pulses (unless the person asked
 * for less motion) and tells assistive technology the page is loading.
 */
export function SkeletonFrame({
  label = 'Loading',
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className,
  children,
}: Readonly<{
  /** What assistive technology announces, e.g. "Loading your recipes". */
  label?: string;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <output
      aria-busy="true"
      className={cn(
        'block animate-pulse motion-reduce:animate-none',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      {children}
    </output>
  );
}
