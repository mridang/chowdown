import type { ElementType, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-8',
  lg: 'p-6 sm:p-8',
} as const;

/**
 * The white, bordered, rounded box content sits in (a step list, a form, an
 * approval screen). `padding` is one of a few sizes rather than whatever each
 * page picked; `as` changes the tag (a `section`, a `li`, a `form`).
 */
export function Card({
  as: Tag = 'div',
  padding = 'md',
  className,
  children,
  ...props
}: {
  as?: ElementType;
  padding?: keyof typeof PADDING;
  className?: string;
  children: ReactNode;
  [prop: string]: unknown;
}) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-ink/10 bg-white',
        PADDING[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
