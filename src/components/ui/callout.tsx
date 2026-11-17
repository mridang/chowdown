import { cn } from '@/components/ui/cn';
import type { ReactElement, ReactNode } from 'react';

/**
 * The colours of each kind of message. `neutral` is a quiet note; `plain` is
 * the same tint with ordinary ink, for a message that must be read rather than
 * glanced at; `highlight` calls attention without alarm; `error` is for what
 * went wrong.
 */
const TONES = {
  neutral: 'bg-sand text-muted',
  plain: 'bg-sand text-ink',
  highlight: 'bg-marigold/25 text-ink',
  error: 'bg-red-50 text-red-800',
} as const;

/** The box a message sits in: a compact one under a form, or a wide strip. */
const LAYOUTS = {
  inline: 'rounded-control px-4 py-3 text-sm leading-relaxed',
  banner: 'rounded-card px-5 py-4',
} as const;

/**
 * A short message set in a tinted box: a note, a warning, an error. `inline` is
 * the compact line under a form or a button; `banner` is the wider strip above
 * a page's content. An `error` is announced to screen readers as it appears.
 */
export function Callout({
  tone = 'neutral',
  layout = 'inline',
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className,
  children,
}: Readonly<{
  tone?: keyof typeof TONES;
  layout?: keyof typeof LAYOUTS;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(TONES[tone], LAYOUTS[layout], className)}
    >
      {children}
    </div>
  );
}
