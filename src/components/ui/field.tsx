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

/** The height of a search box. */
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
}: Readonly<
  {
    size?: keyof typeof HEIGHTS;
    /** A control at the right end, inside the box (usually the submit button). */
    action?: ReactNode;
    className?: string;
  } & Omit<ComponentProps<'input'>, 'size'>
>): ReactElement {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-control border border-field bg-white pl-3.5 transition',
        'focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-ink/15',
        action ? 'pr-1' : 'pr-3.5',
        HEIGHTS[size],
        className,
      )}
    >
      <SearchIcon size="md" className="shrink-0 text-subtle" />
      <input
        type="search"
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
        {...props}
      />
      {action}
    </label>
  );
}

/** The look of a text box, shared by the single-line and multi-line ones. */
const BOX =
  'w-full rounded-control border border-field bg-white px-3.5 text-base text-ink transition placeholder:text-subtle hover:border-ink focus:border-ink focus:outline-2 focus:outline-offset-0 focus:outline-ink/15';

/**
 * A labelled form control: the visible label above, an optional line of help
 * under it, then the control itself. The label is tied to the control by `id`,
 * so clicking it focuses the field and screen readers announce it. When there
 * is help text, or an error, the control is also pointed at them
 * (`aria-describedby`) so they are read out with the field, and an error marks
 * the control `aria-invalid`. Pass the control as the single child.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: Readonly<{
  /** The control's `id`: the label points at it. */
  id: string;
  label: string;
  /** A line of help under the label, read out with the field. */
  hint?: string;
  /** What is wrong with the value, shown under the control and announced as it appears. */
  error?: string;
  children: ReactNode;
}>): ReactElement {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = describedByIds([
    hint ? hintId : undefined,
    error ? errorId : undefined,
  ]);
  const control =
    describedBy &&
    isValidElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(
      children,
    )
      ? cloneElement(children, {
          'aria-describedby': describedBy,
          ...(error ? { 'aria-invalid': true } : {}),
        })
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
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-sm font-medium text-ember"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The value for an `aria-describedby`: the ids that are present, joined by
 * spaces, or `undefined` when there are none (so the attribute is left off
 * rather than pointing at nothing).
 */
export function describedByIds(
  ids: readonly (string | undefined)[],
): string | undefined {
  const present = ids.filter((id): id is string => Boolean(id));
  return present.length > 0 ? present.join(' ') : undefined;
}

/** A single-line text box. */
export function TextInput({
  className,
  ...props
}: Readonly<ComponentProps<'input'>>): ReactElement {
  return (
    <input type="text" className={cn(BOX, 'h-11', className)} {...props} />
  );
}

/**
 * A multi-line text box. `mono` shows code-like text such as Cooklang. `grow`
 * makes it grow with what is typed, up to 60% of the screen (the `autogrow`
 * rule in `globals.css`; a browser without `field-sizing` keeps the height that
 * `rows` gives it). It starts three lines tall; `[--autogrow-rows:8]` in
 * `className` starts it taller.
 */
export function TextArea({
  mono,
  grow,
  className,
  ...props
}: Readonly<
  { mono?: boolean; grow?: boolean } & ComponentProps<'textarea'>
>): ReactElement {
  return (
    <textarea
      className={cn(
        BOX,
        'py-3 leading-relaxed',
        mono && 'font-mono text-[13px]',
        grow && 'autogrow',
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
}: Readonly<{
  tone: 'error' | 'note';
  children: ReactNode;
}>): ReactElement {
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
}: Readonly<ComponentProps<'select'>>): ReactElement {
  return (
    <span className="relative">
      <select
        className={cn(
          'h-10 appearance-none rounded-control border border-field bg-white pr-9 pl-3 text-sm font-medium text-ink transition outline-none hover:border-ink focus:border-ink',
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
}: Readonly<{ label: string } & ComponentProps<'select'>>): ReactElement {
  return (
    <label
      className={cn('flex items-center gap-2.5 text-sm text-muted', className)}
    >
      <span>{label}</span>
      <Select {...props}>{children}</Select>
    </label>
  );
}
