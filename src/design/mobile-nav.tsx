'use client';

import Link from 'next/link';

import { MenuIcon } from './icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown';

/** The phone navigation: a menu button that opens the main links. */
export function MobileNav({ links }: { links: [string, string][] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu"
        className="rounded-control hover:bg-ink/5 focus-visible:outline-ink grid h-10 w-10 place-items-center outline-none focus-visible:outline-2 md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {links.map(([label, href]) => (
          <DropdownMenuItem key={label} asChild>
            <Link href={href}>{label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
