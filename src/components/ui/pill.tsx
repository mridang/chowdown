import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** The border, fill and weight of each kind of pill. */
const VARIANTS = {
  /** An outlined pill with the weight of the text around it, for tags. */
  plain: 'border border-field bg-white hover:border-ink',
  outline: 'border border-field bg-white font-medium hover:border-ink',
  solid: 'bg-ink font-semibold text-white hover:bg-ink/85',
} as const;

/** The height and side padding of each size. */
const SIZES = {
  sm: 'h-8 px-3',
  md: 'h-9 px-4',
} as const;

/** A small rounded link: a shortcut, a tag. `solid` is the one that stands out. */
export function PillLink({
  href,
  variant = 'outline',
  size = 'md',
  className,
  children,
}: Readonly<{
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <Link
      href={href}
      className={cn(
        'focus-ring inline-flex items-center gap-1.5 rounded-full text-sm transition',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}
