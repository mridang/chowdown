'use client';

import Link from 'next/link';

import {
  ChevronIcon,
  HeartIcon,
  LogoutIcon,
  PlugIcon,
  SearchIcon,
} from './icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown';

/**
 * The signed-in account control. Closed, it is an avatar (with a green dot) and
 * the first name; opened, it says which account you are in and offers the
 * account links. It is a Radix menu, so it closes on outside click and Escape
 * and works from the keyboard.
 */
export function AccountMenu({ name, email }: { name: string; email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group rounded-control hover:bg-ink/5 focus-visible:outline-ink data-[state=open]:bg-ink/5 flex h-10 items-center gap-2 pr-2 pl-1 transition outline-none focus-visible:outline-2 sm:pr-3">
        <span className="bg-ink relative grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-white">
          {name.slice(0, 1)}
          <span className="border-paper bg-live absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2" />
        </span>
        <span className="hidden text-sm font-semibold sm:block">{name}</span>
        <ChevronIcon className="text-ink/65 hidden h-4 w-4 transition group-data-[state=open]:rotate-180 sm:block" />
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <span className="text-ink/65 block text-xs">Signed in as</span>
          <span className="block truncate font-semibold">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/design/search">
            <SearchIcon className="text-ink/65 h-[18px] w-[18px]" />
            Your recipes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/design/search?fav=1">
            <HeartIcon className="text-ink/65 h-[18px] w-[18px]" />
            Favourites
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/design/connect">
            <PlugIcon className="text-ink/65 h-[18px] w-[18px]" />
            Connect an assistant
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/design/home">
            <LogoutIcon className="text-ink/65 h-[18px] w-[18px]" />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
