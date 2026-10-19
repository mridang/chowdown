import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { CenteredCard } from '@/components/site/centered-card';
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
import { clientIdentity, describeRedirect } from '@/lib/oauth/display';
import { appOriginFromHeaders, getDatabase } from '@/lib/util';

import { ConsentCard } from './consent-card';

/** The tab title of the approval screen. */
export const metadata: Metadata = { title: 'Connect an app · chowdown' };

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

  return (
    <CenteredCard>
      <ConsentCard
        clientName={client.name}
        identity={clientIdentity(client)}
        redirect={describeRedirect(redirectUri)}
        scopes={scope}
        email={user.email}
        fields={AUTHORIZE_FIELDS.flatMap((name) => {
          const value = params[name];
          return value === undefined ? [] : [{ name, value }];
        })}
      />
    </CenteredCard>
  );
}
