'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

import { activeSection, APP_NAV } from '@/components/site/nav-links';

/**
 * The main navigation on wide screens, marking the current section. It reads
 * the address (and so must render on the client, inside a `Suspense`).
 */
export function HeaderNav(): ReactElement {
  const pathname = usePathname();
  const favourites = useSearchParams().get('fav') === '1';
  const active = activeSection(pathname, favourites);
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {APP_NAV.map(({ key, label, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'flex h-10 items-center rounded-control px-3 text-sm font-medium transition hover:bg-ink/5',
            active === key
              ? 'text-ink underline decoration-2 underline-offset-10'
              : 'text-muted',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
