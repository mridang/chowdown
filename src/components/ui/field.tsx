import type { ComponentProps, ReactNode } from 'react';

import { ChevronIcon, SearchIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

const HEIGHTS = { md: 'h-10', lg: 'h-12' } as const;

/**
 * A search box: a bordered control with the magnifier at the left, the input in
 * the middle and an optional action (a button) at the right, all one height.
 */
export function SearchField({
  size = 'md',
  action,
  className,
  ...props
}: {
  size?: keyof typeof HEIGHTS;
  action?: ReactNode;
  className?: string;
} & Omit<ComponentProps<'input'>, 'size'>) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-control border border-ink/25 bg-white pl-3.5 transition',
        'focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-ink/15',
        action ? 'pr-1' : 'pr-3.5',
        HEIGHTS[size],
        className,
      )}
    >
      <SearchIcon className="text-ink/65 h-5 w-5 shrink-0" />
      <input
        type="search"
        className="placeholder:text-ink/45 h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        {...props}
      />
      {action}
    </label>
  );
}

/** A select with a custom chevron, matching the height and border of other fields. */
export function SelectField({
  label,
  className,
  children,
  ...props
}: { label: string } & ComponentProps<'select'>) {
  return (
    <label
      className={cn('flex items-center gap-2.5 text-sm text-ink/65', className)}
    >
      <span>{label}</span>
      <span className="relative">
        <select
          className="rounded-control border-ink/25 text-ink hover:border-ink focus:border-ink h-10 appearance-none border bg-white pr-9 pl-3 text-sm font-medium transition outline-none"
          {...props}
        >
          {children}
        </select>
        <ChevronIcon className="text-ink/65 pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
      </span>
    </label>
  );
}
