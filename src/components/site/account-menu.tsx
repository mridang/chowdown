'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { ChevronIcon, HeartIcon, LogoutIcon, PlugIcon, SearchIcon } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';

/**
 * The person's Google photo, or their initial when there is none or it fails to
 * load. Google's photo host refuses requests that carry a referrer, hence the
 * referrer policy.
 */
export function Avatar({ name, picture }: { name: string; picture?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="bg-ink relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-semibold text-white">
      {picture && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a third-party avatar, already sized
        <img
          src={picture}
          alt=""
          width={32}
          height={32}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/**
 * The signed-in account control. Closed, it is the person's photo and "Hi
 * Mridang"; opened, it says which account you are in and offers the account
 * links. It is a Radix menu, so it closes on outside click and Escape and works
 * from the keyboard.
 */
export function AccountMenu({
  firstName,
  name,
  email,
  picture,
}: {
  firstName: string;
  name: string;
  email: string;
  picture?: string;
}) {
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/sessions/self', { method: 'DELETE' });
    } finally {
      window.location.assign('/');
    }
  }, []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group rounded-control hover:bg-ink/5 focus-visible:outline-ink data-[state=open]:bg-ink/5 flex h-10 items-center gap-2 pr-2 pl-1 transition outline-none focus-visible:outline-2 sm:pr-3">
        <Avatar name={name} picture={picture} />
        <span className="hidden text-sm font-semibold sm:block">
          Hi {firstName}
        </span>
        <ChevronIcon className="text-ink/65 hidden h-4 w-4 transition group-data-[state=open]:rotate-180 sm:block" />
        <span className="sr-only sm:hidden">Account menu, signed in as {firstName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <span className="text-ink/65 block text-xs">Signed in as</span>
          <span className="block truncate font-semibold">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app">
            <SearchIcon className="text-ink/65 h-[18px] w-[18px]" />
            Your recipes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app?fav=1">
            <HeartIcon className="text-ink/65 h-[18px] w-[18px]" />
            Favourites
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/connect">
            <PlugIcon className="text-ink/65 h-[18px] w-[18px]" />
            Connect an assistant
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onSelect={() => void signOut()}>
          <LogoutIcon className="text-ink/65 h-[18px] w-[18px]" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
