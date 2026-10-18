import type { ElementType, ReactNode } from 'react';

import { cn } from './cn';

/** The page column: one max width and one set of gutters, used everywhere. */
export function Container({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

const SURFACES = {
  page: 'bg-blush text-ink',
  white: 'bg-white text-ink',
  ink: 'bg-ink text-white',
} as const;

/** A full-width band of one surface colour, with consistent vertical rhythm. */
export function Section({
  surface = 'page',
  children,
  className,
}: {
  surface?: keyof typeof SURFACES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('py-12 sm:py-16 lg:py-20', SURFACES[surface], className)}
    >
      {children}
    </section>
  );
}

/** The small tracked-caps line above a heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn('text-label font-semibold uppercase text-ember', className)}
    >
      {children}
    </p>
  );
}

const HEADINGS = {
  display: 'text-5xl leading-[1.04] sm:text-6xl lg:text-7xl',
  h1: 'text-4xl leading-[1.08] sm:text-5xl',
  h2: 'text-3xl leading-tight sm:text-4xl',
  h3: 'text-2xl leading-tight',
  h4: 'text-xl leading-snug',
} as const;

/** A heading in the display serif. `variant` sets the size, `as` the HTML tag. */
export function Heading({
  variant = 'h2',
  as: Tag = 'h2',
  children,
  className,
}: {
  variant?: keyof typeof HEADINGS;
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        'font-display font-semibold tracking-tight',
        HEADINGS[variant],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** A heading with an eyebrow above it and an optional action at the right. */
export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
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
