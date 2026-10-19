'use client';

import { usePathname } from 'next/navigation';
import {
  useCallback,
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
 * Whether focus has moved out of a popover to somewhere else on the page.
 *
 * A keyboard user who tabs past the last item (or back past the button) has
 * left the panel, which must not stay open behind them. Focus going nowhere
 * (`next` is null: the window lost focus, or a click landed on something that
 * cannot take focus) is not leaving; a click outside is handled separately.
 *
 * @param root The popover's outer element (button and panel together).
 * @param next The element receiving focus, if there is one.
 */
export function focusLeft(
  root: Pick<Node, 'contains'>,
  next: Node | null,
): boolean {
  return next !== null && !root.contains(next);
}

/**
 * The handler for key presses while a popover is open: Escape closes it and
 * puts focus back on its button (otherwise focus would be left on an item that
 * has just disappeared). Other keys are left to whatever has focus.
 *
 * @param close Closes the panel.
 * @param focusButton Moves focus back to the popover's button.
 */
export function escapeHandler(
  close: () => void,
  focusButton: () => void,
): (event: Readonly<Pick<KeyboardEvent, 'key'>>) => void {
  return (event) => {
    if (event.key === 'Escape') {
      close();
      focusButton();
    }
  };
}

/** Where a popover was opened: the page's path at that moment. */
type OpenedOn = Readonly<{ pathname: string | null }>;

/**
 * Whether a popover that was opened on `openedOn` is still open on the page at
 * `pathname`. Navigating (a link elsewhere, the back button) puts the person on
 * a different page, and a panel left floating over it would be a stranger there.
 * Deriving this from the path means no effect has to notice the navigation.
 *
 * @param openedOn Where it was opened, or `null` if it is closed.
 * @param pathname The path of the page being shown now.
 */
export function isOpenOn(
  openedOn: OpenedOn | null,
  pathname: string | null,
): boolean {
  return openedOn !== null && openedOn.pathname === pathname;
}

/**
 * A button that opens a small panel of links and actions (the account menu and
 * the phone navigation). It is a disclosure, not an ARIA "menu": the button says
 * whether the panel is open, and the panel is an ordinary list that Tab moves
 * through. It closes on Escape (returning focus to the button), on a click
 * outside, and when anything inside it is chosen. The panel opens beneath the
 * button, lined up with its right edge. It weighs about a kilobyte,
 * where a full menu library would weigh dozens on every page.
 *
 * As a disclosure, opening it leaves focus on the button: the panel follows the
 * button in the page, so the next Tab enters it. It also closes when focus
 * moves out of it, and when the page navigates (the back button, say) while it
 * is open. A click outside closes it without moving focus, because focus is
 * already going to whatever was clicked.
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
  const pathname = usePathname();
  // Remember which page it was opened on: a different page means it is closed,
  // with no effect needed to notice the navigation.
  const [openedOn, setOpenedOn] = useState<OpenedOn | null>(null);
  const open = isOpenOn(openedOn, pathname);
  const setOpen = useCallback(
    (next: boolean) => setOpenedOn(next ? { pathname } : null),
    [pathname],
  );
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
    const onKeyDown = escapeHandler(
      () => setOpen(false),
      () => trigger.current?.focus(),
    );
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
  }, [open, setOpen]);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (focusLeft(event.currentTarget, event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
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

/**
 * A line of status in a popover panel that is not something to press (for
 * instance "Google Drive connected"). It is plain text rather than a disabled
 * button, which would be skipped by Tab but still announced as "unavailable".
 */
export function PopoverStatus({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <p
      role="status"
      className="text-muted flex h-10 items-center gap-3 px-3 text-sm font-medium"
    >
      {children}
    </p>
  );
}

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
