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
import { clientAddress } from '@/lib/oauth/limits';
import { getDatabase } from '@/lib/util';
import { appOriginFromHeaders } from '@/lib/util/origin';

import { ConsentCard } from './consent-card';

/** The tab title of the approval screen. */
export const metadata: Metadata = { title: 'Connect an app' };

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
 * A way back to an app that registered itself without any check. The error is
 * not sent to it automatically (that would turn this site into a redirector
 * anyone can aim at an address of their choosing); the person sees the address
 * and decides.
 */
function ReturnToApp({
  address,
  href,
}: Readonly<{ address: string; href: string }>): ReactElement {
  return (
    <p className="mt-5 text-sm leading-relaxed text-muted">
      The app asked to be told about this at{' '}
      <code className="font-semibold break-all">{address}</code>. It registered
      itself without any check, so only go back if you started this connection
      and trust it.{' '}
      <a
        href={href}
        rel="noreferrer"
        className="focus-ring rounded-control text-ember underline underline-offset-4 hover:text-ink"
      >
        Return to the app
      </a>
    </p>
  );
}

/**
 * The screen an assistant sends people to when they connect it: it shows who is
 * asking and what for, and the user approves or declines. Signing in (with
 * Google, as for the rest of the app) happens first if needed, then returns
 * here. The decision is posted to `/oauth/consent`, which re-checks everything.
 *
 * A problem with the request is shown on this page, not sent to the app's
 * redirect address, unless the app's addresses come from a document its own
 * domain published (see `AuthorizeCheck`). The page is served with status 200
 * even for an error: a Server Component cannot set a status, and the error is
 * for a person to read, not a program (a program is told about problems by the
 * redirect, or at the token endpoint).
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
  const requestHeaders = await headers();
  const origin = appOriginFromHeaders(requestHeaders);
  const address = clientAddress(requestHeaders);
  const db = getDatabase();

  const check = await validateAuthorizeRequest(params, origin, (id) =>
    resolveClient(db, id, fetch, { origin, address }),
  );
  if (!check.ok) {
    const errorUrl = check.redirect
      ? redirectWith(check.redirect.uri, {
          error: check.error,
          error_description: check.description,
          state: check.redirect.state,
          iss: origin,
        })
      : undefined;
    if (check.redirect?.automatic && errorUrl) {
      redirect(errorUrl);
    }
    return (
      <CenteredCard>
        <Eyebrow>Connect an app</Eyebrow>
        <Heading as="h1" variant="h3" className="mt-2">
          Can&apos;t connect this app
        </Heading>
        <p className="mt-3 leading-relaxed text-muted">{check.description}</p>
        <p className="mt-5 font-mono text-sm text-subtle">
          Error: {check.error}
        </p>
        {check.redirect && errorUrl ? (
          <ReturnToApp
            address={describeRedirect(check.redirect.uri).address}
            href={errorUrl}
          />
        ) : null}
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
    redirect(`/auth/login?returnTo=${encodeURIComponent(here)}`);
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
        redirect={describeRedirect(redirectUri, clientIdentity(client))}
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
