import type { ReactElement, ReactNode } from 'react';

import { Eyebrow } from '@/components/ui/layout';

/**
 * One fact about a recipe: a line icon in a tinted square, a small label and the
 * value. Meant for a `dl`, which may only hold terms and descriptions, so the
 * icon sits inside the term, positioned to the left of both lines.
 */
export function Fact({
  icon,
  label,
  children,
}: Readonly<{
  icon: ReactNode;
  label: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <div className="relative min-h-11 pl-14.5 leading-tight">
      <Eyebrow as="dt" tone="subtle">
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 grid size-11 place-items-center rounded-control bg-sand text-ember"
        >
          {icon}
        </span>
        {label}
      </Eyebrow>
      <dd className="mt-0.5 text-base font-semibold wrap-break-word">
        {children}
      </dd>
    </div>
  );
}
