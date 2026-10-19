import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';

import { ChevronIcon, SearchIcon } from '@/components/icons';
import { Callout } from '@/components/ui/callout';
import { cn } from '@/components/ui/cn';

const HEIGHTS = { md: 'h-10', lg: 'h-12' } as const;

/**
 * A search box: a bordered control with the magnifier at the left, the input in
 * the middle and an optional action (a button) at the right, all one height.
 */
export function SearchField({
  size = 'md',
  action,
  className,
  ...props
}: {
  size?: keyof typeof HEIGHTS;
  action?: ReactNode;
  className?: string;
} & Omit<ComponentProps<'input'>, 'size'>) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-control border border-ink/25 bg-white pl-3.5 transition',
        'focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-ink/15',
        action ? 'pr-1' : 'pr-3.5',
        HEIGHTS[size],
        className,
      )}
    >
      <SearchIcon size="md" className="shrink-0 text-subtle" />
      <input
        type="search"
        className="placeholder:text-subtle h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        {...props}
      />
      {action}
    </label>
  );
}

/** The look of a text box, shared by the single-line and multi-line ones. */
const BOX =
  'w-full rounded-control border border-ink/25 bg-white px-3.5 text-base text-ink transition placeholder:text-subtle hover:border-ink/50 focus:border-ink focus:outline-2 focus:outline-offset-0 focus:outline-ink/15';

/**
 * A labelled form control: the visible label above, an optional line of help
 * under it, then the control itself. The label is tied to the control by `id`,
 * so clicking it focuses the field and screen readers announce it; when there
 * is help text the control is also pointed at it (`aria-describedby`), so the
 * help is read out with the field. Pass the control as the single child.
 */
export function FormField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = `${id}-hint`;
  const control =
    hint && isValidElement(children)
      ? cloneElement(
          children as ReactElement<{ 'aria-describedby'?: string }>,
          {
            'aria-describedby': hintId,
          },
        )
      : children;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{control}</div>
    </div>
  );
}

/** A single-line text box. */
export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input type="text" className={cn(BOX, 'h-11', className)} {...props} />
  );
}

/** A multi-line text box; `mono` shows code-like text such as Cooklang. */
export function TextArea({
  mono,
  className,
  ...props
}: { mono?: boolean } & ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        BOX,
        'py-3 leading-relaxed',
        mono && 'font-mono text-[13px]',
        className,
      )}
      {...props}
    />
  );
}

/** A message under a form: an error, or a note about the current draft. */
export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'note';
  children: ReactNode;
}) {
  return (
    <Callout tone={tone === 'error' ? 'error' : 'highlight'} className="mt-4">
      {children}
    </Callout>
  );
}

/** A drop-down list with a custom chevron; wrap it in a label or give it one. */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <span className="relative">
      <select
        className={cn(
          'h-10 appearance-none rounded-control border border-ink/25 bg-white pr-9 pl-3 text-sm font-medium text-ink transition outline-none hover:border-ink focus:border-ink',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronIcon
        size="sm"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-subtle"
      />
    </span>
  );
}

/** A select with its label beside it, matching the height and border of other fields. */
export function SelectField({
  label,
  className,
  children,
  ...props
}: { label: string } & ComponentProps<'select'>) {
  return (
    <label
      className={cn('flex items-center gap-2.5 text-sm text-muted', className)}
    >
      <span>{label}</span>
      <Select {...props}>{children}</Select>
    </label>
  );
}
