import Link from 'next/link';

import { cn } from '@/components/ui/cn';

/** One step of the trail; the last has no link when it is the current page. */
export interface Crumb {
  label: string;
  href?: string;
}

/** "Recipes / Indian": where this page sits, each part a link back up. */
export function Breadcrumb({
  crumbs,
  className,
}: {
  crumbs: Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('text-subtle text-sm', className)}
    >
      {crumbs.map((crumb, index) => (
        <span key={`${index}-${crumb.label}`}>
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
        </span>
      ))}
    </nav>
  );
}
