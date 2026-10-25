'use client';

import type { ReactElement } from 'react';

import { MenuIcon } from '@/components/icons';
import { Popover } from '@/components/ui/popover';

import { MenuLink } from '@/components/site/menu-link';
import type { NavLink } from '@/components/site/nav-links';

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
          {links.map((link) => (
            <MenuLink key={link.label} {...link} />
          ))}
        </nav>
      </Popover>
    </div>
  );
}
