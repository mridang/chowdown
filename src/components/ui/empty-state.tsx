import type { ElementType, ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Eyebrow, Heading } from '@/components/ui/layout';

/**
 * What stands in for content that isn't there: no recipes yet, nothing matches
 * the filters, Drive can't be reached, Drive isn't connected. A headline, a line
 * or two, and optionally the way forward. `dashed` is the outline for "nothing
 * here"; `card` is the solid box for a step the person has to take.
 */
export function EmptyState({
  variant = 'dashed',
  eyebrow,
  title,
  headingAs = 'h2',
  actions,
  className,
  children,
}: {
  variant?: 'dashed' | 'card';
  eyebrow?: string;
  title: string;
  /** The heading's tag; a page that is only this uses `h1`. */
  headingAs?: ElementType;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading as={headingAs} variant="h3" className={eyebrow ? 'mt-2' : ''}>
        {title}
      </Heading>
      {children}
      {actions ? (
        <div className="mt-6 flex justify-center">{actions}</div>
      ) : null}
    </>
  );
  if (variant === 'card') {
    return (
      <Card
        padding="none"
        className={cn(
          'mx-auto max-w-2xl px-6 py-12 text-center sm:px-10',
          className,
        )}
      >
        {body}
      </Card>
    );
  }
  return (
    <div
      className={cn(
        'rounded-card border border-dashed border-ink/25 px-6 py-16 text-center',
        className,
      )}
    >
      {body}
    </div>
  );
}
