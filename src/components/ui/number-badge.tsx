import { cn } from '@/components/ui/cn';
import type { ReactElement } from 'react';

/** The width, height and type size of each badge. */
const SIZES = {
  sm: 'h-7 w-7 text-sm',
  md: 'h-9 w-9 text-base',
  lg: 'h-12 w-12 text-xl',
} as const;

/** The colours of each badge: `flame` stands out, `quiet` recedes. */
const TONES = {
  flame: 'bg-flame text-ink',
  quiet: 'bg-ink/10 text-muted',
} as const;

/**
 * The numbered circle beside a step. Purely decorative: the list it sits in
 * (an `ol`) already numbers its items for assistive technology.
 */
export function NumberBadge({
  value,
  size = 'sm',
  tone = 'flame',
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className,
}: Readonly<{
  value: number;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className?: string;
}>): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {value}
    </span>
  );
}
