import type { ReactNode } from 'react';

import { Heading } from '@/components/ui/layout';

/** A titled block of a legal page: a heading, then its text or list. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <Heading variant="h3">{title}</Heading>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A list item with a flame-coloured marker, so lists read as part of the brand. */
export function LegalItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="bg-flame mt-[0.65rem] h-1.5 w-1.5 shrink-0 rounded-full"
      />
      <span>{children}</span>
    </li>
  );
}
