import Link from 'next/link';
import type { ReactElement } from 'react';

import { PanIcon, SparkIcon } from '@/components/icons';
import { Logo } from '@/components/site/logo';
import { Container } from '@/components/ui/layout';

import type { NavLink } from './nav-links';

/**
 * The jagged edge above the footer: one flame-orange polygon whose top edge
 * climbs and falls in broad peaks. It scales with the width (the ratio stays
 * 1512:240).
 */
function ZigZag(): ReactElement {
  return (
    <svg
      viewBox="0 0 1512 240"
      className="text-flame block h-auto w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        fill="currentColor"
        d="M0 0V239.461H1511.78L1511.57 87.2116L922.286 214.468L793.24 62.2531L383.847 166.712L0 0Z"
      />
    </svg>
  );
}

/** Only pages anyone can open belong in the footer: no account or app links. */
const COLUMNS: readonly Readonly<{
  title: string;
  links: readonly NavLink[];
}>[] = [
  {
    title: 'Explore',
    links: [
      { label: 'How it works', href: '/#features' },
      { label: 'Questions', href: '/#faq' },
    ],
  },
  {
    title: 'About',
    links: [{ label: 'Privacy', href: '/privacy' }],
  },
];

/**
 * The footer, after Gran Luchito's: a tall zigzag edge, a flame block with the
 * black wordmark and a line about the product, a few plain links, and a thin
 * marigold strip with the small print. It stays short on purpose: account,
 * sign-out and connection links live in the header and on their own pages.
 */
export function SiteFooter(): ReactElement {
  return (
    <footer className="relative mt-24 sm:mt-32">
      <PanIcon
        className="text-flame/10 pointer-events-none absolute -top-4 left-[10%] h-28 w-28 sm:-top-14 sm:h-44 sm:w-44"
        strokeWidth={1}
      />
      <SparkIcon
        className="text-flame/10 pointer-events-none absolute -top-2 right-[8%] h-20 w-20 sm:-top-10 sm:h-32 sm:w-32"
        strokeWidth={1}
      />
      <ZigZag />
      <div className="bg-flame text-ink -mt-px">
        <Container className="flex flex-col gap-10 pt-2 pb-14 sm:flex-row sm:items-start sm:justify-between md:pb-16">
          <div>
            <Logo className="origin-left scale-125" />
            <p className="mt-8 max-w-sm text-base leading-relaxed">
              Recipes kept as plain text in your own Google Drive. Yours to
              cook, to keep and to take anywhere.
            </p>
          </div>
          <div className="flex gap-16">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="text-label font-semibold uppercase">
                  {column.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-3 text-sm font-semibold">
                  {column.links.map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="hover:underline">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </div>
      <div className="bg-marigold">
        <Container className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-3 text-xs">
          <span>
            © 2026 chowdown. Your recipes stay in your own Google Drive.
          </span>
        </Container>
      </div>
    </footer>
  );
}
