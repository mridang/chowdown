'use client';

import Link from 'next/link';
import { useState, type ReactElement } from 'react';

import {
  ChevronIcon,
  LogoutIcon,
  PlugIcon,
  SparkIcon,
  TrashIcon,
} from '@/components/icons';
import {
  POPOVER_ITEM,
  Popover,
  PopoverLabel,
  PopoverSeparator,
} from '@/components/ui/popover';

import { MenuLink } from './menu-link';
import { DeleteAccountDialog } from './delete-account-dialog';
import type { DriveLink } from './drive-link';
import { InstallIosHint } from './install-ios-hint';
import { useInstallPrompt } from './use-install-prompt';

/**
 * The person's Google photo, or their initial when there is none or it fails to
 * load. Google's photo host refuses requests that carry a referrer, hence the
 * referrer policy.
 */
export function Avatar({
  name,
  picture,
}: Readonly<{
  /** Their name; its first letter stands in for a missing photo. */
  name: string;
  /** The address of their Google profile photo, if they have one. */
  picture?: string;
}>): ReactElement {
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
 * Signs the person out: ends the session on the server, then goes to the home
 * page whether or not that request succeeded (a failed request must not leave
 * them stuck on a page that thinks they are still signed in).
 */
async function signOut(): Promise<void> {
  try {
    await fetch('/api/sessions/self', { method: 'DELETE' });
  } finally {
    window.location.assign('/');
  }
}

/**
 * The signed-in account control. Closed, it is the person's photo and "Hi
 * Mridang"; opened, it says which account you are in and offers only what the
 * header doesn't already (connecting an assistant, installing the app), Sign
 * out, and Delete account (which asks first). The recipe links live in the
 * header itself. Google Drive shows here as the same entry as the header's
 * button: "Connect Google Drive", then "Open Drive" once connected.
 */
export function AccountMenu({
  firstName,
  name,
  email,
  picture,
  drive,
}: Readonly<{
  firstName: string;
  name: string;
  email: string;
  picture?: string;
  /** The Drive entry: connect it, or open it once connected. */
  drive: DriveLink;
}>): ReactElement {
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { install } = useInstallPrompt();
  return (
    <>
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
        buttonClassName="group rounded-control hover:bg-ink/5 data-[state=open]:bg-ink/5 flex h-10 items-center gap-2 pr-2 pl-1 transition sm:pr-3 focus-ring-flush"
        panelClassName="w-64"
      >
        <PopoverLabel caption="Signed in as">{email}</PopoverLabel>
        <PopoverSeparator />
        <Link href="/connect" className={POPOVER_ITEM}>
          <PlugIcon size="menu" className="text-subtle" />
          Connect an assistant
        </Link>
        <MenuLink {...drive} icon="drive" />
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
        {/* Safari on iPhone has no install button to offer; this says where to tap. */}
        <InstallIosHint />
        <PopoverSeparator />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signOut();
          }}
          className={POPOVER_ITEM}
        >
          <LogoutIcon size="menu" className="text-subtle" />
          Sign out
        </button>
        <button
          type="button"
          className={`${POPOVER_ITEM} text-ember`}
          onClick={() => setConfirmingDelete(true)}
        >
          <TrashIcon size="menu" />
          Delete account
        </button>
      </Popover>
      {/* Outside the popover: the menu unmounts its items the moment one is chosen. */}
      <DeleteAccountDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      />
    </>
  );
}
