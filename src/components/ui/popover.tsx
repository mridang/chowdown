'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * A button that opens a small panel of links and actions (the account menu and
 * the phone navigation). It is a disclosure, not an ARIA "menu": the button says
 * whether the panel is open, and the panel is an ordinary list that Tab moves
 * through. It closes on Escape (returning focus to the button), on a click
 * outside, and when anything inside it is chosen. It weighs about a kilobyte,
 * where a full menu library would weigh dozens on every page.
 */
export function Popover({
  label,
  button,
  buttonClassName,
  panelClassName,
  align = 'end',
  children,
}: {
  /** The button's accessible name when `button` is just an icon. */
  label?: string;
  /** What the button shows. */
  button: ReactNode;
  buttonClassName?: string;
  panelClassName?: string;
  align?: 'start' | 'end';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    // Choosing a link or an action inside the panel closes it.
    const onPanelClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('a, button')) {
        setOpen(false);
      }
    };
    const panelElement = panel.current;
    panelElement?.addEventListener('click', onPanelClick);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      panelElement?.removeEventListener('click', onPanelClick);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        data-state={open ? 'open' : 'closed'}
        className={buttonClassName}
      >
        {button}
      </button>
      {open ? (
        <div
          id={panelId}
          ref={panel}
          className={cn(
            'rounded-card border-ink/15 text-ink absolute top-full z-50 mt-2 min-w-56 border bg-white p-1.5',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** One row in a popover panel; style a link or a button with it. */
export const POPOVER_ITEM =
  'flex h-10 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-sm font-medium transition hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50';
