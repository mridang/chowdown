'use client';

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';

import { CloseIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/** What the parts of one dialog share: whether it is open, and the ids that tie its title and description to it. */
interface DialogState {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly titleId: string;
  readonly descriptionId: string;
}

/** The nearest enclosing {@link Dialog}'s state; `null` outside one. */
const DialogContext = createContext<DialogState | null>(null);

/** The enclosing dialog's state, or an error for a part used outside a `<Dialog>`. */
function useDialog(): DialogState {
  const state = useContext(DialogContext);
  if (!state) {
    throw new Error('Dialog parts must be used inside <Dialog>.');
  }
  return state;
}

/**
 * Modal surfaces (cook mode, the phone filter drawer, the delete confirmation),
 * built on the browser's own `<dialog>`: it traps focus, makes everything behind
 * it inert, closes on Escape, and returns focus to whatever opened it, with no
 * library to download. It can be uncontrolled (a {@link DialogTrigger} opens it)
 * or controlled (`open` and `onOpenChange`).
 *
 * This is the state holder; the visible pieces are {@link DialogTrigger},
 * {@link DialogContent}, {@link DialogTitle} and {@link DialogDescription}.
 */
export function Dialog({
  open: controlled,
  onOpenChange,
  children,
}: Readonly<{
  /** Whether it is open, when the caller keeps that state; leave out to let it keep its own. */
  open?: boolean;
  /** Told whenever it asks to open or close (a trigger, Escape, a click outside). */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}>): ReactElement {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const id = useId();
  const setOpen = useCallback(
    (next: boolean) => {
      setOwn(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        titleId: `${id}-title`,
        descriptionId: `${id}-description`,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

/** The button that opens the dialog; `asChild` lends the behaviour to your own button. */
export function DialogTrigger({
  asChild,
  children,
  ...props
}: Readonly<{ asChild?: boolean } & ComponentProps<'button'>>): ReactElement {
  const { setOpen } = useDialog();
  const only = asChild ? Children.only(children) : null;
  if (isValidElement<ComponentProps<'button'>>(only)) {
    return cloneElement(only, { onClick: () => setOpen(true) });
  }
  return (
    <button type="button" onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
}

/** The dialog's heading; the dialog is announced by this name. */
export function DialogTitle({
  children,
  ...props
}: Readonly<ComponentProps<'h2'>>): ReactElement {
  const { titleId } = useDialog();
  return (
    <h2 id={titleId} {...props}>
      {children}
    </h2>
  );
}

/** A line of explanation under the title, read out with it by assistive technology. */
export function DialogDescription(
  props: Readonly<ComponentProps<'p'>>,
): ReactElement {
  const { descriptionId } = useDialog();
  return <p id={descriptionId} {...props} />;
}

/**
 * Bring a `<dialog>` element into step with whether it should be open. Showing
 * it modally (not just setting `open`) is what traps focus and makes the page
 * behind it inert; asking for what it already is does nothing.
 */
export function syncModal(
  dialog: Pick<HTMLDialogElement, 'open' | 'showModal' | 'close'>,
  open: boolean,
): void {
  if (open && !dialog.open) {
    dialog.showModal();
  } else if (!open && dialog.open) {
    dialog.close();
  }
}

/**
 * The `closedby` attribute for a dialog, as props to spread onto it. `any` is
 * light dismiss: the browser closes the dialog itself for a click outside it
 * (and for Escape), telling us through the `cancel` event. `none` is a dialog
 * that is busy and must stay until the page says otherwise. React's own types
 * know the attribute, but the lint rule that checks property names does not yet,
 * so it is passed as a spread.
 */
export function closedBy(dismissable: boolean): {
  readonly closedby: 'any' | 'none';
} {
  return { closedby: dismissable ? 'any' : 'none' };
}

/**
 * Whether this browser closes a dialog on a click outside it by itself, that
 * is, understands `closedby` (Chrome 134, Firefox 141, Safari 26). Where it does
 * not, the dialog has to watch for that click, with {@link backdropClickHandler}.
 *
 * @param dialog Any dialog element; the feature is looked for on its prototype.
 */
export function supportsLightDismiss(dialog: object): boolean {
  return 'closedBy' in dialog;
}

/**
 * The click handler for the dialog element, which is also its own backdrop: a
 * click that lands on the dialog itself, rather than on something inside it, is
 * a click outside, and closes it. Only needed where the browser has no light
 * dismiss of its own ({@link supportsLightDismiss}).
 */
export function backdropClickHandler(
  dialog: EventTarget,
  close: () => void,
): (event: Readonly<Pick<Event, 'target'>>) => void {
  return (event) => {
    if (event.target === dialog) {
      close();
    }
  };
}

/**
 * The handler for the dialog's `cancel` event (Escape, or a click outside under
 * light dismiss). The browser would close the dialog itself; this stops that and
 * routes it through the dialog's own state, so the two never disagree and a busy
 * dialog can refuse to close.
 */
export function cancelHandler(
  dismissable: boolean,
  close: () => void,
): (event: Readonly<Pick<Event, 'preventDefault'>>) => void {
  return (event) => {
    event.preventDefault();
    if (dismissable) {
      close();
    }
  };
}

/**
 * How long, in milliseconds, a closed dialog keeps its content on screen so the
 * fade-out in `globals.css` (200ms) has something to fade. A little longer than
 * the transition, because nothing tells us when a CSS transition has ended in a
 * browser that does not play one, and then the wait is simply never noticed.
 */
export const LEAVE_MS = 250;

/**
 * Whether a dialog's content should still be on the page: while it is open, and
 * for {@link LEAVE_MS} after it closes. Without the second part the content
 * would vanish the instant the dialog is closed and an empty panel would fade.
 *
 * @param open Whether the dialog is open now.
 */
function useMounted(open: boolean): boolean {
  const [leaving, setLeaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Noticing the change while rendering, rather than in an effect, means the
  // content is never missing for even one frame between "closed" and "leaving".
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open);
  }
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const timer = setTimeout(() => setLeaving(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  return open || leaving;
}

/**
 * Whether a {@link DialogDescription} appears anywhere in `children`.
 *
 * The dialog points `aria-describedby` at its description, but only if there is
 * one: a reference to an id that is not on the page is an error that some screen
 * readers answer by saying nothing at all. It looks through the elements written
 * in the JSX, so a description hidden inside another component's own output is
 * not seen; the dialog then simply goes without one, which is safe.
 */
export function hasDescription(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) =>
      isValidElement<{ children?: ReactNode }>(child) &&
      (child.type === DialogDescription ||
        hasDescription(child.props.children)),
  );
}

/** The shape and position of each kind of dialog. */
const VARIANTS = {
  /** Fills the whole screen. */
  full: 'inset-0 h-full max-h-none w-full max-w-none',
  /** A panel sliding in from the left edge. */
  drawer: 'inset-y-0 left-0 h-full max-h-none w-[min(22rem,90vw)] max-w-none',
  /** A small box in the middle. */
  center:
    'top-1/2 left-1/2 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card',
} as const;

/** The dimmed backdrop and the content panel together. */
export function DialogContent({
  variant = 'full',
  className,
  children,
  closeLabel = 'Close',
  showClose = true,
  dismissable = true,
  ...props
}: Readonly<
  {
    variant?: keyof typeof VARIANTS;
    /** The corner close button's accessible name. */
    closeLabel?: string;
    /** Show the corner close button. */
    showClose?: boolean;
    /** Whether Escape and a click on the backdrop close it (off while busy). */
    dismissable?: boolean;
    children: ReactNode;
  } & Omit<ComponentProps<'dialog'>, 'open'>
>): ReactElement {
  const { open, setOpen, titleId, descriptionId } = useDialog();
  // Held on for a moment after closing so the fade-out has content to fade.
  const mounted = useMounted(open);
  // Closed, nothing of the content is rendered, so there is nothing to point at.
  const described = mounted && hasDescription(children);
  const ref = useRef<HTMLDialogElement>(null);

  // Keep the element in step with the state: showing it modally is what traps
  // focus and inerts the page behind it.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    syncModal(dialog, open);
  }, [open]);

  // A click outside closes a dialog that can be dismissed. The browser does it
  // itself under `closedby="any"`; this is only for the ones that cannot.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !dismissable || supportsLightDismiss(dialog)) {
      return;
    }
    const onClick = backdropClickHandler(dialog, () => setOpen(false));
    dialog.addEventListener('click', onClick);
    return () => dialog.removeEventListener('click', onClick);
  }, [dismissable, setOpen]);

  return (
    <dialog
      ref={ref}
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={described ? descriptionId : undefined}
      {...closedBy(dismissable)}
      // Escape or a click outside: the browser would close it itself; route it
      // through our state so the two never disagree (and so a busy dialog can
      // refuse).
      onCancel={cancelHandler(dismissable, () => setOpen(false))}
      className={cn(
        'bg-paper text-ink fixed m-0 overflow-y-auto p-0 backdrop:bg-ink/50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {mounted ? (
        <>
          {children}
          {showClose ? (
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => setOpen(false)}
              className="rounded-control hover:bg-ink/5 absolute top-3 right-3 grid h-10 w-10 place-items-center transition focus-ring-flush"
            >
              <CloseIcon size="md" />
            </button>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
