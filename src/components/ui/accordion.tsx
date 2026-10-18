import type { ComponentProps } from 'react';

import { ChevronIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/**
 * Collapsible sections (filters, FAQ), built on the browser's own `<details>`:
 * keyboard use, focus and screen-reader roles come for free and there is no
 * script to download. Give several items the same `name` to make them
 * exclusive (opening one closes the others).
 */
export function Accordion({ className, ...props }: ComponentProps<'div'>) {
  return <div className={className} {...props} />;
}

export function AccordionItem({
  className,
  ...props
}: ComponentProps<'details'>) {
  return (
    <details
      className={cn('group border-b border-ink/10 last:border-b-0', className)}
      {...props}
    />
  );
}

/** The clickable heading row, with a chevron that turns when open. */
export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<'summary'>) {
  return (
    <summary
      className={cn(
        'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-control text-left transition [&::-webkit-details-marker]:hidden',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronIcon className="text-ink/65 h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div className={cn('pb-4', className)} {...props}>
      {children}
    </div>
  );
}
