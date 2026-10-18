'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';

import { CloseIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/**
 * Modal surfaces (cook mode, the phone filter drawer), built on Radix: focus is
 * trapped while open, Escape closes, and focus returns to the trigger.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

const VARIANTS = {
  /** Fills the whole screen. */
  full: 'inset-0',
  /** A panel sliding in from the left edge. */
  drawer: 'inset-y-0 left-0 w-[min(22rem,90vw)]',
} as const;

/** The dimmed backdrop and the content panel together. */
export function DialogContent({
  variant = 'full',
  className,
  children,
  closeLabel = 'Close',
  ...props
}: {
  variant?: keyof typeof VARIANTS;
  closeLabel?: string;
  children: ReactNode;
} & ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-ink/50 fixed inset-0 z-40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 overflow-y-auto bg-paper text-ink outline-none',
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="rounded-control hover:bg-ink/5 focus-visible:outline-ink absolute top-3 right-3 grid h-10 w-10 place-items-center transition focus-visible:outline-2"
        >
          <CloseIcon className="h-5 w-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
