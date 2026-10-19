import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { CenteredCard } from '@/components/site/centered-card';
import { CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { DriveConnectPanel } from '@/components/site/drive-connect';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isDriveConnected, wasDriveConnected } from '@/lib/auth/drive-access';
import { resolveClient } from '@/lib/db/oauth';
import {
  AUTHORIZE_FIELDS,
  redirectWith,
  validateAuthorizeRequest,
  type AuthorizeParams,
} from '@/lib/oauth/authorize-request';
import { SCOPE_READ, SCOPE_WRITE } from '@/lib/oauth/scopes';
import { appOriginFromHeaders, getDatabase } from '@/lib/util';

/** The tab title of the approval screen. */
export const metadata: Metadata = { title: 'Connect an app · chowdown' };

/** What each scope lets the app do, in plain words. */
const SCOPE_TEXT: Readonly<Record<string, string>> = {
  [SCOPE_READ]: 'See your recipes, search them and find similar ones',
  [SCOPE_WRITE]:
    'Add, edit, tag, favourite and annotate recipes, and change your settings',
};

/** First value of each query parameter. */
function flatten(
  raw: Readonly<Record<string, string | readonly string[] | undefined>>,
): AuthorizeParams {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

/**
 * Where approving will send the person, in the short form the screen shows: the
 * host of the redirect address, or its scheme when it has no host (a custom
 * scheme such as `claude://`). An address that cannot be parsed is shown as
 * written; it has already been validated, so this is only a safety net.
 */
function destinationOf(redirectUri: string): string {
  try {
    const url = new URL(redirectUri);
    return url.host || url.protocol;
  } catch {
    return redirectUri;
  }
}

/**
 * The screen an assistant sends people to when they connect it: it shows who is
 * asking and what for, and the user approves or declines. Signing in (with
 * Google, as for the rest of the app) happens first if needed, then returns
 * here. The decision is posted to `/oauth/consent`, which re-checks everything.
 */
export default async function AuthorizePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}>): Promise<ReactElement> {
  const raw = await searchParams;
  const params = flatten(raw);
  const origin = appOriginFromHeaders(await headers());
  const db = getDatabase();

  const check = await validateAuthorizeRequest(params, origin, (id) =>
    resolveClient(db, id),
  );
  if (!check.ok) {
    if (check.redirect) {
      redirect(
        redirectWith(check.redirect.uri, {
          error: check.error,
          error_description: check.description,
          state: check.redirect.state,
          iss: origin,
        }),
      );
    }
    return (
      <CenteredCard>
        <Eyebrow>Connect an app</Eyebrow>
        <Heading as="h1" variant="h3" className="mt-2">
          Can&apos;t connect this app
        </Heading>
        <p className="text-muted mt-3 leading-relaxed">{check.description}</p>
        <p className="text-subtle mt-5 font-mono text-sm">
          Error: {check.error}
        </p>
      </CenteredCard>
    );
  }

  const user = await getCurrentUser();
  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  ).toString();
  const here = `/oauth/authorize?${query}`;
  if (!user) {
    redirect(`/api/auth/login?returnTo=${encodeURIComponent(here)}`);
  }
  if (!isDriveConnected(user)) {
    // An assistant has nothing to reach until the recipes' Drive is connected;
    // connect it first, then come straight back to this approval.
    return (
      <CenteredCard framed={false}>
        <DriveConnectPanel
          heading="h1"
          reconnect={wasDriveConnected(user)}
          returnTo={here}
        />
      </CenteredCard>
    );
  }

  const { client, redirectUri, scope } = check.request;
  const target = destinationOf(redirectUri);

  return (
    <CenteredCard>
      <Eyebrow>Connect an app</Eyebrow>
      <Heading as="h1" variant="h3" className="mt-2 break-words">
        Connect <span className="text-ember">{client.name}</span> to chowdown?
      </Heading>
      <p className="text-muted mt-3">
        Signed in as <span className="font-medium">{user.email}</span>. This app
        will be able to:
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {scope.map((s) => (
          <li key={s} className="flex items-start gap-3">
            <CheckIcon size="md" className="text-forest mt-0.5 shrink-0" />
            <span className="leading-relaxed">{SCOPE_TEXT[s] ?? s}</span>
          </li>
        ))}
      </ul>
      <Callout className="mt-5">
        After you approve, you&apos;ll be sent back to{' '}
        <span className="font-semibold break-all">{target}</span>. Only approve
        apps you trust. You can disconnect it any time from chowdown.
      </Callout>
      <form action="/oauth/consent" method="post" className="mt-6">
        {AUTHORIZE_FIELDS.map((name) =>
          params[name] === undefined ? null : (
            <input key={name} type="hidden" name={name} value={params[name]} />
          ),
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="outline"
            size="lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            name="decision"
            value="approve"
            variant="primary"
            size="lg"
          >
            Approve
          </Button>
        </div>
      </form>
    </CenteredCard>
  );
}
