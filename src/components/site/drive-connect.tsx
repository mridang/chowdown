import type { ReactElement } from 'react';

import { DriveIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { driveConnectHref, type DriveAttempt } from '@/lib/auth/drive-access';

/** What to tell someone whose last attempt didn't work. */
const ATTEMPT_MESSAGE: Readonly<Record<DriveAttempt, string>> = {
  denied:
    'Google Drive was not connected: the permission was not granted. chowdown needs it to keep your recipes in your Drive.',
  error:
    'Something went wrong connecting Google Drive. Nothing was changed, so you can try again.',
};

interface DriveConnectProps {
  /** Not connected now, but was before: say "reconnect". */
  readonly reconnect?: boolean;
  /** Where to land after connecting; defaults to the recipe list. */
  readonly returnTo?: string;
  /** What went wrong last time, if they just came back from a failed attempt. */
  readonly attempt?: DriveAttempt;
}

/** The panel can stand in for a whole page, which then needs its own `h1`. */
type PanelProps = DriveConnectProps & { readonly heading?: 'h1' | 'h2' };

/** The notice's own line, for pages where "saved copies" doesn't apply. */
type NoticeProps = DriveConnectProps & { readonly message?: string };

/** The button that starts connecting. */
function ConnectButton({
  reconnect,
  returnTo,
  size,
}: Pick<DriveConnectProps, 'reconnect' | 'returnTo'> &
  Readonly<{ size?: 'md' | 'lg' }>): ReactElement {
  return (
    <ButtonLink href={driveConnectHref(returnTo, { force: true })} size={size}>
      <DriveIcon size="md" />
      {reconnect ? 'Reconnect Google Drive' : 'Connect Google Drive'}
    </ButtonLink>
  );
}

/**
 * A card that stands in for a page that can't work without Drive (the recipe
 * list with nothing cached, "Add recipes"): what connecting does, how little it
 * allows, and the button. Signing in never asks for Drive, so this is where
 * that second step is explained.
 */
export function DriveConnectPanel({
  reconnect,
  returnTo,
  attempt,
  heading = 'h2',
}: PanelProps): ReactElement {
  return (
    <EmptyState
      variant="card"
      eyebrow={reconnect ? 'Connection lost' : 'One more step'}
      title={
        reconnect ? 'Reconnect your Google Drive' : 'Connect your Google Drive'
      }
      headingAs={heading}
      actions={
        <ConnectButton reconnect={reconnect} returnTo={returnTo} size="lg" />
      }
    >
      <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
        {reconnect
          ? 'Google stopped accepting chowdown’s access to your Drive, perhaps because it was removed. Your recipes are still in your Drive. Reconnect to sync them again.'
          : 'chowdown keeps your recipes as plain text files in a “Recipes” folder in your own Google Drive. Connect it to see, add and edit them.'}
      </p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-subtle">
        chowdown can only see the files it creates there, and nothing else in
        your Drive.
      </p>
      {attempt ? (
        <Callout className="mx-auto mt-5 max-w-xl">
          {ATTEMPT_MESSAGE[attempt]}
        </Callout>
      ) : null}
    </EmptyState>
  );
}

/**
 * A slim strip above content that still works without Drive (the cached recipes
 * of someone whose connection lapsed): says what is missing and offers the fix.
 */
export function DriveConnectNotice({
  reconnect,
  returnTo,
  attempt,
  message = 'Recipes shown here are saved copies. Connect your Drive to sync, add and edit them.',
}: NoticeProps): ReactElement {
  return (
    <Callout
      shape="banner"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-semibold text-ink">
          {reconnect
            ? 'Google Drive is disconnected'
            : 'Google Drive is not connected'}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed">
          {attempt ? ATTEMPT_MESSAGE[attempt] : message}
        </p>
      </div>
      <ConnectButton reconnect={reconnect} returnTo={returnTo} />
    </Callout>
  );
}

/**
 * What stands in for the recipes when Google Drive is connected but could not
 * be reached just now (and nothing is cached yet): not "no recipes", which
 * would be untrue.
 */
export function DriveUnreachable(): ReactElement {
  return (
    <EmptyState title="Couldn’t reach Google Drive">
      <p className="mx-auto mt-2 max-w-md text-muted">
        Your recipes are safe in your Drive. Reload the page in a moment to try
        again.
      </p>
    </EmptyState>
  );
}
