import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

const VARIANTS = {
  outline: 'border border-ink/20 bg-white font-medium hover:border-ink',
  solid: 'bg-ink font-semibold text-white hover:bg-ink/85',
} as const;

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
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}) {
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
