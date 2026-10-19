'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '@/components/ui/cn';

/**
 * Run `close` once the click that chose a menu item has finished being handled.
 *
 * Closing straight away is a bug that looks like nothing happening: React has
 * unmounted the item by the time it gets the click, so the item's own handler
 * (Sign out, say) never runs, and a link falls back to a full page load. A
 * timeout of zero lets the click reach the item first.
 */
export function closeAfterClick(close: () => void): void {
  setTimeout(close, 0);
}

/**
 * A button that opens a small panel of links and actions (the account menu and
 * the phone navigation). It is a disclosure, not an ARIA "menu": the button says
 * whether the panel is open, and the panel is an ordinary list that Tab moves
 * through. It closes on Escape (returning focus to the button), on a click
 * outside, and when anything inside it is chosen. The panel opens beneath the
 * button, lined up with its right edge. It weighs about a kilobyte,
 * where a full menu library would weigh dozens on every page.
 */
export function Popover({
  label,
  button,
  buttonClassName,
  panelClassName,
  children,
}: Readonly<{
  /** The button's accessible name when `button` is just an icon. */
  label?: string;
  /** What the button shows. */
  button: ReactNode;
  buttonClassName?: string;
  panelClassName?: string;
  children: ReactNode;
}>): ReactElement {
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
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    // Choosing a link or an action inside the panel closes it, but only once
    // the click has finished being handled (see closeAfterClick).
    const onPanelClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('a, button')
      ) {
        closeAfterClick(() => setOpen(false));
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
            'rounded-card border-line text-ink absolute top-full right-0 z-50 mt-2 min-w-56 border bg-white p-1.5',
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** The class list for one row in a popover panel; style a link or a button with it. */
export const POPOVER_ITEM =
  'flex h-10 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-sm font-medium transition hover:bg-ink/5 disabled:opacity-50 focus-ring-flush';

/** A thin rule between groups of items in a popover panel. */
export function PopoverSeparator(): ReactElement {
  return <div className="my-1.5 h-px bg-ink/10" role="separator" />;
}

/** A small, non-interactive caption in a popover panel (who is signed in, say). */
export function PopoverLabel({
  caption,
  children,
}: Readonly<{
  /** The small grey line above the value ("Signed in as"). */
  caption: string;
  /** The value itself, kept to one line. */
  children: ReactNode;
}>): ReactElement {
  return (
    <div className="px-3 py-2 text-sm">
      <span className="block text-xs text-subtle">{caption}</span>
      <span className="block truncate font-semibold">{children}</span>
    </div>
  );
}
