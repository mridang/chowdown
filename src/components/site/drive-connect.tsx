import { DriveIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { driveConnectHref, type DriveAttempt } from '@/lib/auth/drive-access';

/** What to tell someone whose last attempt didn't work. */
const ATTEMPT_MESSAGE: Record<DriveAttempt, string> = {
  denied:
    'Google Drive was not connected: the permission was not granted. chowdown needs it to keep your recipes in your Drive.',
  error:
    'Something went wrong connecting Google Drive. Nothing was changed, so you can try again.',
};

interface DriveConnectProps {
  /** Not connected now, but was before: say "reconnect". */
  reconnect?: boolean;
  /** Where to land after connecting; defaults to the recipe list. */
  returnTo?: string;
  /** What went wrong last time, if they just came back from a failed attempt. */
  attempt?: DriveAttempt;
}

/** The panel can stand in for a whole page, which then needs its own `h1`. */
type PanelProps = DriveConnectProps & { heading?: 'h1' | 'h2' };

/** The notice's own line, for pages where "saved copies" doesn't apply. */
type NoticeProps = DriveConnectProps & { message?: string };

/** The button that starts connecting. */
function ConnectButton({
  reconnect,
  returnTo,
  size,
}: Pick<DriveConnectProps, 'reconnect' | 'returnTo'> & { size?: 'md' | 'lg' }) {
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
}: PanelProps) {
  return (
    <div className="rounded-card border-ink/10 mx-auto max-w-2xl border bg-white px-6 py-12 text-center sm:px-10">
      <Eyebrow>{reconnect ? 'Connection lost' : 'One more step'}</Eyebrow>
      <Heading as={heading} variant="h3" className="mt-2">
        {reconnect
          ? 'Reconnect your Google Drive'
          : 'Connect your Google Drive'}
      </Heading>
      <p className="text-muted mx-auto mt-3 max-w-xl leading-relaxed">
        {reconnect
          ? 'Google stopped accepting chowdown’s access to your Drive, perhaps because it was removed. Your recipes are still in your Drive. Reconnect to sync them again.'
          : 'chowdown keeps your recipes as plain text files in a “Recipes” folder in your own Google Drive. Connect it to see, add and edit them.'}
      </p>
      <p className="text-subtle mx-auto mt-2 max-w-xl text-sm leading-relaxed">
        chowdown can only see the files it creates there, and nothing else in
        your Drive.
      </p>
      {attempt ? (
        <p className="rounded-control bg-sand text-muted mx-auto mt-5 max-w-xl px-4 py-3 text-sm leading-relaxed">
          {ATTEMPT_MESSAGE[attempt]}
        </p>
      ) : null}
      <div className="mt-6 flex justify-center">
        <ConnectButton reconnect={reconnect} returnTo={returnTo} size="lg" />
      </div>
    </div>
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
}: NoticeProps) {
  return (
    <div className="rounded-card bg-sand flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">
          {reconnect
            ? 'Google Drive is disconnected'
            : 'Google Drive is not connected'}
        </p>
        <p className="text-muted mt-0.5 text-sm leading-relaxed">
          {attempt ? ATTEMPT_MESSAGE[attempt] : message}
        </p>
      </div>
      <ConnectButton reconnect={reconnect} returnTo={returnTo} />
    </div>
  );
}

/**
 * What stands in for the recipes when Google Drive is connected but could not
 * be reached just now (and nothing is cached yet): not "no recipes", which
 * would be untrue.
 */
export function DriveUnreachable() {
  return (
    <div className="rounded-card border-ink/25 border border-dashed px-6 py-16 text-center">
      <Heading variant="h3">Couldn’t reach Google Drive</Heading>
      <p className="text-muted mx-auto mt-2 max-w-md">
        Your recipes are safe in your Drive. Reload the page in a moment to try
        again.
      </p>
    </div>
  );
}
