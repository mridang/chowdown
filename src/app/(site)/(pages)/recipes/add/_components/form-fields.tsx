import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** The look shared by the text boxes on the add-recipes page. */
const BOX =
  'w-full rounded-control border border-ink/25 bg-white px-3.5 text-base text-ink transition placeholder:text-subtle hover:border-ink/50 focus:border-ink focus:outline-2 focus:outline-offset-0 focus:outline-ink/15';

/**
 * A labelled form control: the visible label above, an optional line of help
 * under it, then the control itself. The label is tied to the control by `id`,
 * so clicking it focuses the field and screen readers announce it.
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
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-muted mt-1 text-sm">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
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
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'rounded-control mt-4 px-3.5 py-2.5 text-sm',
        tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-marigold/25 text-ink',
      )}
    >
      {children}
    </p>
  );
}
