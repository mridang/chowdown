import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactElement,
} from 'react';

import { cn } from '@/components/ui/cn';

/** The inner space of a card, from none at all to the roomy default. */
const PADDING = {
  none: '',
  xs: 'p-3',
  sm: 'p-4',
  md: 'p-5 sm:p-8',
  lg: 'p-6 sm:p-8',
} as const;

/**
 * The white, bordered, rounded box content sits in (a step list, a form, an
 * approval screen). `padding` is one of a few sizes rather than whatever each
 * page picked; `as` changes the tag (a `section`, a `li`, a `button`), and the
 * props of that tag (`onClick`, `aria-labelledby`) are then accepted and
 * type-checked as they would be on the tag itself.
 */
export function Card<Tag extends ElementType = 'div'>({
  as,
  padding = 'md',
  className,
  ...props
}: Readonly<{
  as?: Tag;
  padding?: keyof typeof PADDING;
  className?: string;
}> &
  Omit<
    ComponentPropsWithoutRef<Tag>,
    'as' | 'padding' | 'className'
  >): ReactElement {
  const Component: ElementType = as ?? 'div';
  return (
    <Component
      className={cn(
        'rounded-card border border-line bg-white',
        PADDING[padding],
        className,
      )}
      {...props}
    />
  );
}
