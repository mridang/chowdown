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
  const ref = useRef<HTMLDialogElement>(null);

  // Keep the element in step with the state: showing it modally is what traps
  // focus and inerts the page behind it.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The dialog element is also its own backdrop: a click that lands on it,
  // rather than on the content inside, is a click outside.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !dismissable) {
      return;
    }
    const onClick = (event: Event) => {
      if (event.target === dialog) {
        setOpen(false);
      }
    };
    dialog.addEventListener('click', onClick);
    return () => dialog.removeEventListener('click', onClick);
  }, [dismissable, setOpen]);

  // No scrolling behind a modal. The page's own `overflow` is put back as it
  // was (not simply cleared) when the dialog closes.
  useEffect(() => {
    if (!open) {
      return;
    }
    const { style } = document.body;
    const before = style.getPropertyValue('overflow');
    style.setProperty('overflow', 'hidden');
    return () => style.setProperty('overflow', before);
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Escape: the browser would close it itself; route it through our state so
      // the two never disagree (and so a busy dialog can refuse).
      onCancel={(event) => {
        event.preventDefault();
        if (dismissable) {
          setOpen(false);
        }
      }}
      className={cn(
        'bg-paper text-ink fixed m-0 overflow-y-auto p-0 backdrop:bg-ink/50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {open ? (
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
