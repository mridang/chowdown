import type { ComponentProps, ReactElement } from 'react';

import { ChevronIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/**
 * Collapsible sections (filters, FAQ), built on the browser's own `<details>`:
 * keyboard use, focus and screen-reader roles come for free and there is no
 * script to download. Give several items the same `name` to make them
 * exclusive (opening one closes the others).
 *
 * This is the outer wrapper; put one {@link AccordionItem} inside it for each
 * section.
 */
export function Accordion({
  className,
  ...props
}: Readonly<ComponentProps<'div'>>): ReactElement {
  return <div className={className} {...props} />;
}

/**
 * One collapsible section: a `<details>` with a rule beneath it (none under the
 * last). It holds an {@link AccordionTrigger} and an {@link AccordionContent}.
 * Pass `name` to make it exclusive with the other items that share the name,
 * and `open` to start it expanded.
 */
export function AccordionItem({
  className,
  ...props
}: Readonly<ComponentProps<'details'>>): ReactElement {
  return (
    <details
      className={cn('group border-b border-line last:border-b-0', className)}
      {...props}
    />
  );
}

/** The clickable heading row, with a chevron that turns when open. */
export function AccordionTrigger({
  className,
  children,
  ...props
}: Readonly<ComponentProps<'summary'>>): ReactElement {
  return (
    <summary
      className={cn(
        'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-control text-left transition [&::-webkit-details-marker]:hidden',
        'focus-ring',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronIcon
        size="sm"
        className="text-subtle shrink-0 transition-transform group-open:rotate-180"
      />
    </summary>
  );
}

/** What an {@link AccordionItem} reveals when it is open. */
export function AccordionContent({
  className,
  children,
  ...props
}: Readonly<ComponentProps<'div'>>): ReactElement {
  return (
    <div className={cn('pb-4', className)} {...props}>
      {children}
    </div>
  );
}
