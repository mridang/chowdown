import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** One key for each of the three dots of the title bar. */
const DOTS = [0, 1, 2] as const;

/**
 * A window frame (three dots and an optional file name along the top), so a
 * mock-up on the landing page reads as a real piece of the product. The frame
 * is announced as one image described by `label`, because what is inside it is
 * illustration and not content to read.
 */
export function WindowFrame({
  children,
  label,
  title,
  className,
}: Readonly<{
  children: ReactNode;
  /** What the picture shows, for assistive technology. */
  label: string;
  /** A name shown in the title bar, such as a file name. */
  title?: string;
  className?: string;
}>): ReactElement {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'overflow-hidden rounded-card border border-line bg-white',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-sand px-4 py-2.5">
        {/* The three dots of a window's title bar. */}
        {DOTS.map((dot) => (
          <span key={dot} className="size-2.5 rounded-full bg-ink/20" />
        ))}
        {title ? (
          <span className="ml-3 truncate font-mono text-xs text-subtle">
            {title}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
