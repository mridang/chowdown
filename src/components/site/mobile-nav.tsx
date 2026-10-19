'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

import { MenuIcon } from '@/components/icons';
import { isApiHref } from '@/components/ui/button';
import { POPOVER_ITEM, Popover } from '@/components/ui/popover';

import type { NavLink } from './nav-links';

/**
 * The phone navigation: a menu button that opens the main links. Hidden from
 * `md` up, where the header shows the links itself.
 */
export function MobileNav({
  links,
}: Readonly<{ links: readonly NavLink[] }>): ReactElement {
  return (
    <div className="md:hidden">
      <Popover
        label="Menu"
        button={<MenuIcon size="md" />}
        buttonClassName="rounded-control hover:bg-ink/5 grid h-10 w-10 place-items-center focus-ring-flush"
        panelClassName="w-56"
      >
        <nav aria-label="Menu">
          {links.map(({ label, href }) =>
            isApiHref(href) ? (
              <a key={label} href={href} className={POPOVER_ITEM}>
                {label}
              </a>
            ) : (
              <Link key={label} href={href} className={POPOVER_ITEM}>
                {label}
              </Link>
            ),
          )}
        </nav>
      </Popover>
    </div>
  );
}
