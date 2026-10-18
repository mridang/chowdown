'use client';

import Link from 'next/link';

import { MenuIcon } from '@/components/icons';
import { POPOVER_ITEM, Popover } from '@/components/ui/popover';

/** The phone navigation: a menu button that opens the main links. */
export function MobileNav({ links }: { links: [string, string][] }) {
  return (
    <div className="md:hidden">
      <Popover
        label="Menu"
        button={<MenuIcon className="h-5 w-5" />}
        buttonClassName="rounded-control hover:bg-ink/5 focus-visible:outline-ink grid h-10 w-10 place-items-center focus-visible:outline-2"
        panelClassName="w-56"
      >
        <nav aria-label="Menu">
          {links.map(([label, href]) =>
            // An /api address answers with a redirect to another site, which the
            // client router can't follow, so it gets a plain link.
            href.startsWith('/api/') ? (
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
