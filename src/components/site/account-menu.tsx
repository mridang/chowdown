'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import {
  CheckIcon,
  ChevronIcon,
  DriveIcon,
  LogoutIcon,
  PlugIcon,
  SparkIcon,
} from '@/components/icons';
import { cn } from '@/components/ui/cn';
import { POPOVER_ITEM, Popover } from '@/components/ui/popover';
import { driveConnectHref } from '@/lib/auth/drive-access';

import { useInstallPrompt } from './use-install-prompt';

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
 * Mridang"; opened, it says which account you are in and offers only what the
 * header doesn't already (connecting an assistant, installing the app) and Sign
 * out. The recipe links live in the header itself. Google Drive shows here as
 * an action until it is connected, then as a greyed-out "connected" line.
 */
export function AccountMenu({
  firstName,
  name,
  email,
  picture,
  driveConnected,
}: {
  firstName: string;
  name: string;
  email: string;
  picture?: string;
  driveConnected: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { install } = useInstallPrompt();
  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/sessions/self', { method: 'DELETE' });
    } finally {
      window.location.assign('/');
    }
  }, []);
  return (
    <Popover
      button={
        <>
          <Avatar name={name} picture={picture} />
          <span className="hidden text-sm font-semibold sm:block">
            Hi {firstName}
          </span>
          <ChevronIcon
            size="sm"
            className="text-subtle hidden transition group-data-[state=open]:rotate-180 sm:block"
          />
          <span className="sr-only sm:hidden">
            Account menu, signed in as {firstName}
          </span>
        </>
      }
      buttonClassName="group rounded-control hover:bg-ink/5 focus-visible:outline-ink data-[state=open]:bg-ink/5 flex h-10 items-center gap-2 pr-2 pl-1 transition focus-visible:outline-2 sm:pr-3"
      panelClassName="w-64"
    >
      <div className="px-3 py-2 text-sm">
        <span className="text-subtle block text-xs">Signed in as</span>
        <span className="block truncate font-semibold">{email}</span>
      </div>
      <div className="bg-ink/10 my-1.5 h-px" />
      <Link href="/connect" className={POPOVER_ITEM}>
        <PlugIcon size="menu" className="text-subtle" />
        Connect an assistant
      </Link>
      {driveConnected ? (
        <button
          type="button"
          disabled
          className={cn(POPOVER_ITEM, 'cursor-default hover:bg-transparent')}
        >
          <CheckIcon size="menu" className="text-forest" />
          Google Drive connected
        </button>
      ) : (
        <a href={driveConnectHref()} className={POPOVER_ITEM}>
          <DriveIcon size="menu" className="text-subtle" />
          Connect Google Drive
        </a>
      )}
      {install ? (
        <button
          type="button"
          onClick={() => void install()}
          className={POPOVER_ITEM}
        >
          <SparkIcon size="menu" className="text-subtle" />
          Install app
        </button>
      ) : null}
      <div className="bg-ink/10 my-1.5 h-px" />
      <button
        type="button"
        disabled={busy}
        onClick={() => void signOut()}
        className={POPOVER_ITEM}
      >
        <LogoutIcon size="menu" className="text-subtle" />
        Sign out
      </button>
    </Popover>
  );
}
