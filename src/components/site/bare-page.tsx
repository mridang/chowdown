import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { PanIcon } from '@/components/icons';
import { HEADER_ROW_CLASS } from '@/components/site/header-height';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';

/**
 * A page outside the site frame: the thin marigold strip, the wordmark and a
 * centred message. Used where the full header would be wrong or unavailable:
 * the not-found and error pages, and the approval screen assistants send people
 * to. It brings its own `<main>` because it does not sit inside the site shell.
 */
export function BarePage({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <div className="flex flex-1 flex-col">
      <header>
        <div className="bg-marigold h-1.5" />
        <div className="border-line border-b">
          <Container className={`flex ${HEADER_ROW_CLASS} items-center`}>
            <Link
              href="/"
              className="font-display text-ink rounded-control text-[1.7rem] leading-none font-bold tracking-tight focus-ring-wide"
            >
              chowdown
            </Link>
          </Container>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center">
        {children}
      </main>
    </div>
  );
}

/**
 * A full-page message with a headline and a way onward: what the not-found and
 * error pages say. `actions` are the buttons beneath the text. (For a short
 * note inside a page, use `Callout`.)
 */
export function MessagePage({
  eyebrow,
  title,
  children,
  actions,
}: Readonly<{
  eyebrow: string;
  /** The page's one `h1`. */
  title: string;
  /** The explanation under the headline. */
  children: ReactNode;
  actions: ReactNode;
}>): ReactElement {
  return (
    <Container className="py-16 sm:py-24">
      <div className="max-w-xl">
        <PanIcon className="text-flame h-14 w-14" strokeWidth={1.25} />
        <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
        <Heading as="h1" variant="h1" className="mt-3">
          {title}
        </Heading>
        <div className="text-muted mt-5 text-lg leading-relaxed">
          {children}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
      </div>
    </Container>
  );
}
