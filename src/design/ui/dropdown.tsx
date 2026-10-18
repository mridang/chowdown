'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';

import { cn } from './cn';

/** Menus (account, recipe actions), built on Radix: arrow keys, typeahead, outside click. */
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = 'end',
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-56 rounded-card border border-ink/15 bg-white p-1.5 text-ink',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

/** One menu row. Use `asChild` to make it a link. */
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex h-10 cursor-pointer items-center gap-3 rounded-control px-3 text-sm font-medium outline-none transition',
        'data-[highlighted]:bg-ink/5',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn('my-1.5 h-px bg-ink/10', className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-3 py-2 text-sm', className)}
      {...props}
    />
  );
}
