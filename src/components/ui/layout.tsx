import type { ElementType, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

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
  page: 'bg-paper text-ink',
  white: 'bg-white text-ink',
  ink: 'bg-forest text-white',
} as const;

/** A full-width band of one surface colour, with consistent vertical rhythm. */
export function Section({
  surface = 'page',
  children,
  className,
  id,
}: {
  surface?: keyof typeof SURFACES;
  children: ReactNode;
  className?: string;
  /** Lets the header's links jump to this section. */
  id?: string;
}) {
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

const EYEBROW_TONES = {
  /** The accent colour, for the line that introduces a heading. */
  ember: 'text-ember',
  /** Plain ink, for use on a coloured band. */
  ink: 'text-ink',
  /** Quiet grey, for the label of a group or a fact. */
  subtle: 'text-subtle',
} as const;

/**
 * The small tracked-caps line above a heading, or the label of a group. `tone`
 * picks its colour (do not pass a colour class: classes are joined, not merged,
 * so two colours would fight); `as` changes the tag when it labels a term or a
 * heading rather than being a paragraph.
 */
export function Eyebrow({
  as: Tag = 'p',
  tone = 'ember',
  children,
  className,
}: {
  as?: ElementType;
  tone?: keyof typeof EYEBROW_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        'text-label font-semibold uppercase',
        EYEBROW_TONES[tone],
        className,
      )}
    >
      {children}
    </Tag>
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
