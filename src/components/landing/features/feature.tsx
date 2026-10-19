import type { ReactNode } from 'react';

import { Eyebrow, Heading } from '@/components/ui/layout';

/**
 * One selling point: an eyebrow, a heading, a short paragraph and one picture
 * (the children). No lists. `flip` swaps the sides on wide screens so a run of
 * features alternates.
 */
export function Feature({
  eyebrow,
  title,
  body,
  flip,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <div className={flip ? 'lg:order-2' : undefined}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading className="mt-3">{title}</Heading>
        <p className="text-muted mt-5 max-w-md text-lg leading-relaxed">
          {body}
        </p>
      </div>
      <div className={flip ? 'lg:order-1' : undefined}>{children}</div>
    </div>
  );
}
