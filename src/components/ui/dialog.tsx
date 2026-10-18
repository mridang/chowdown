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

/**
 * Modal surfaces (cook mode, the phone filter drawer, the delete confirmation),
 * built on the browser's own `<dialog>`: it traps focus, makes everything behind
 * it inert, closes on Escape, and returns focus to whatever opened it, with no
 * library to download. It can be uncontrolled (a trigger opens it) or controlled
 * (`open` and `onOpenChange`).
 */
interface DialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogState | null>(null);

function useDialog(): DialogState {
  const state = useContext(DialogContext);
  if (!state) {
    throw new Error('Dialog parts must be used inside <Dialog>.');
  }
  return state;
}

export function Dialog({
  open: controlled,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
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
}: { asChild?: boolean } & ComponentProps<'button'>) {
  const { setOpen } = useDialog();
  if (asChild) {
    const only = Children.only(children);
    if (isValidElement(only)) {
      return cloneElement(only as ReactElement<ComponentProps<'button'>>, {
        onClick: () => setOpen(true),
      });
    }
  }
  return (
    <button type="button" onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
}

export function DialogClose({ children, ...props }: ComponentProps<'button'>) {
  const { setOpen } = useDialog();
  return (
    <button type="button" onClick={() => setOpen(false)} {...props}>
      {children}
    </button>
  );
}

export function DialogTitle({ children, ...props }: ComponentProps<'h2'>) {
  const { titleId } = useDialog();
  return (
    <h2 id={titleId} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription(props: ComponentProps<'p'>) {
  const { descriptionId } = useDialog();
  return <p id={descriptionId} {...props} />;
}

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
}: {
  variant?: keyof typeof VARIANTS;
  closeLabel?: string;
  /** Show the corner close button. */
  showClose?: boolean;
  /** Whether Escape and a click on the backdrop close it (off while busy). */
  dismissable?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<'dialog'>, 'open'>) {
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

  // No scrolling behind a modal.
  useEffect(() => {
    if (!open) {
      return;
    }
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
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
              className="rounded-control hover:bg-ink/5 focus-visible:outline-ink absolute top-3 right-3 grid h-10 w-10 place-items-center transition focus-visible:outline-2"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
