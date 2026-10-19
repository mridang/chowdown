import Link from 'next/link';
import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

/** One step of the trail; the last has no link when it is the current page. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * "Recipes / Indian": where this page sits, each part a link back up. It is an
 * ordered list inside a labelled navigation landmark, which is how assistive
 * technology expects a trail, laid out inline so it reads as a line of text and
 * wraps like one.
 */
export function Breadcrumb({
  crumbs,
  className,
}: Readonly<{
  crumbs: readonly Crumb[];
  className?: string;
}>): ReactElement {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('text-subtle text-sm', className)}
    >
      <ol className="m-0 inline list-none p-0">
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className="inline">
            {index > 0 ? (
              <span className="mx-1.5" aria-hidden="true">
                /
              </span>
            ) : null}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="inline-flex h-8 items-center hover:text-ink hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
