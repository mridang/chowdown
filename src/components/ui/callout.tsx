import type { ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

const TONES = {
  neutral: 'bg-sand text-muted',
  highlight: 'bg-marigold/25 text-ink',
  error: 'bg-red-50 text-red-800',
} as const;

const SHAPES = {
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
  shape = 'inline',
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  shape?: keyof typeof SHAPES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(TONES[tone], SHAPES[shape], className)}
    >
      {children}
    </div>
  );
}
