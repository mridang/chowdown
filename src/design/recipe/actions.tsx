'use client';

import { useState } from 'react';

import {
  CheckIcon,
  HeartIcon,
  PrinterIcon,
  ShareIcon,
  SparkIcon,
  TrashIcon,
} from '../icons';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown';

/** A round-cornered icon-and-label button used in the action row. */
const ACTION = 'gap-2';

/** Favourite on or off, shown straight away and saved in the background. */
export function FavouriteToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <Button
      variant="outline"
      aria-pressed={on}
      onClick={() => setOn((value) => !value)}
      className={cn(ACTION, on && 'border-flame text-ember')}
    >
      <HeartIcon filled={on} className="h-[18px] w-[18px]" />
      {on ? 'Favourited' : 'Favourite'}
    </Button>
  );
}

/**
 * Share the recipe using the device's own share sheet where there is one (phones,
 * and many desktops); otherwise copy the address and say so.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        // The share sheet was dismissed; nothing to do.
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button variant="outline" onClick={() => void share()} className={ACTION}>
      {copied ? (
        <CheckIcon className="h-[18px] w-[18px]" />
      ) : (
        <ShareIcon className="h-[18px] w-[18px]" />
      )}
      {copied ? 'Link copied' : 'Share'}
    </Button>
  );
}

/** The less-used actions, tucked in a menu. */
export function MoreMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className="rounded-control border-ink/25 hover:border-ink focus-visible:outline-ink grid h-10 w-10 place-items-center border bg-white text-xl leading-none transition outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span aria-hidden="true">⋯</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>
          <SparkIcon className="text-ink/65 h-[18px] w-[18px]" />
          Auto-tag
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}>
          <PrinterIcon className="text-ink/65 h-[18px] w-[18px]" />
          Print
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-ember">
          <TrashIcon className="h-[18px] w-[18px]" />
          Delete recipe
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
