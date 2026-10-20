import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import { Eyebrow, Heading } from '@/components/ui/layout';

/** The background and text colour of each kind of band. */
const SURFACES = {
  page: 'bg-paper text-ink',
  white: 'bg-white text-ink',
} as const;

/** A full-width band of one surface colour, with consistent vertical rhythm. */
export function Section({
  surface = 'page',
  children,
  className,
  id,
}: Readonly<{
  surface?: keyof typeof SURFACES;
  children: ReactNode;
  className?: string;
  /** Lets the header's links jump to this section. */
  id?: string;
}>): ReactElement {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20 py-12 sm:py-16 lg:py-20',
        SURFACES[surface],
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A heading with an eyebrow above it and an optional action at the right. */
export function SectionHeader({
  eyebrow,
  title,
  action,
}: Readonly<{
  eyebrow?: string;
  title: string;
  /** Something to sit at the right of the heading, such as a "See all" link. */
  action?: ReactNode;
}>): ReactElement {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading className={eyebrow ? 'mt-2' : ''}>{title}</Heading>
      </div>
      {action}
    </div>
  );
}
