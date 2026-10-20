'use client';

import { useState, useSyncExternalStore, type ReactElement } from 'react';

import { CloseIcon, ShareIcon } from '@/components/icons';

import {
  IOS_HINT_TEXT,
  readInstallEnvironment,
  rememberDismissed,
  shouldOfferIosInstall,
  type InstallHost,
} from './ios-install';

/** The live browser, in the shape {@link readInstallEnvironment} reads. */
function browserHost(): InstallHost {
  return {
    navigator,
    matchMedia: (query) => window.matchMedia(query),
    storage: () => window.localStorage,
  };
}

/**
 * Tells the page when the tip's answer may have changed behind its back: the
 * tip was dismissed in another tab. (Whether the device is an iPhone does not
 * change while the page is open.)
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** Whether the tip applies to this browser right now. */
function offerNow(): boolean {
  return shouldOfferIosInstall(readInstallEnvironment(browserHost()));
}

/**
 * A small, dismissible tip for people on Safari on an iPhone or iPad, where the
 * app can't offer an Install button: "Install: tap Share, then Add to Home
 * Screen." Shown wherever the Install entry is offered to everyone else (the
 * account menu), and nowhere else: it renders nothing in other browsers, inside
 * the installed app, and once dismissed (remembered in `localStorage`, and
 * working without it).
 *
 * Whether to show it can only be known in the browser, so the server and the
 * first render say "no" and the browser's own answer takes over straight after,
 * which avoids a mismatch between the two.
 */
export function InstallIosHint(): ReactElement | null {
  const offered = useSyncExternalStore(subscribe, offerNow, () => false);
  // The person has just pressed Hide: go away now, without waiting on storage
  // (which may not exist) to say so.
  const [hidden, setHidden] = useState(false);
  if (!offered || hidden) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 rounded-control bg-marigold/20 py-1 pr-1 pl-3">
      <ShareIcon size="menu" className="shrink-0 text-ink" />
      <p className="flex-1 text-sm leading-snug font-medium">{IOS_HINT_TEXT}</p>
      <button
        type="button"
        onClick={() => {
          rememberDismissed(browserHost());
          setHidden(true);
        }}
        className="focus-ring-flush grid size-11 shrink-0 place-items-center rounded-control transition hover:bg-ink/10"
      >
        <CloseIcon size="sm" />
        <span className="sr-only">Hide the install tip</span>
      </button>
    </div>
  );
}
