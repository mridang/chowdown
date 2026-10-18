import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-ink/85',
  accent: 'bg-flame text-ink hover:bg-flame/90',
  outline: 'border border-ink/25 bg-white text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-ink/5',
} as const;

const SIZES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
} as const;

type Look = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
};

/** The class list for a button look; shared by buttons and button-styled links. */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: Look): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-control font-semibold whitespace-nowrap transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

/** A button. */
export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: Look & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({
  variant,
  size,
  className,
  href,
  children,
}: Look & { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })}>
      {children}
    </Link>
  );
}

/** A square icon-only button with an accessible name. */
export function IconButton({
  label,
  className,
  children,
  ...props
}: { label: string } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-control text-ink transition hover:bg-ink/5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
