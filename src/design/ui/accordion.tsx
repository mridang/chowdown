'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import type { ComponentProps } from 'react';

import { ChevronIcon } from '../icons';
import { cn } from './cn';

/**
 * Collapsible sections (filters, FAQ), built on Radix so keyboard use, focus
 * and screen-reader roles are right without hand-rolled `<details>` tricks.
 */
export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn('border-b border-ink/10 last:border-b-0', className)}
      {...props}
    />
  );
}

/** The clickable heading row, with a chevron that turns when open. */
export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex min-h-11 flex-1 items-center justify-between gap-3 rounded-control text-left transition',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronIcon className="text-ink/65 h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden"
      {...props}
    >
      <div className={cn('pb-4', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
