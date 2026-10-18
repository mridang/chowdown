import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { BarePage } from '@/components/landing/bare-page';
import { CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { DriveConnectPanel } from '@/components/site/drive-connect';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isDriveConnected, wasDriveConnected } from '@/lib/auth/drive-access';
import { resolveClient } from '@/lib/db/oauth';
import {
  redirectWith,
  validateAuthorizeRequest,
  type AuthorizeParams,
} from '@/lib/oauth/authorize-request';
import { SCOPE_READ, SCOPE_WRITE } from '@/lib/oauth/scopes';
import { appOriginFromHeaders, getDatabase } from '@/lib/util';

export const metadata: Metadata = { title: 'Connect an app · chowdown' };

/** The form fields passed through to the consent POST. */
const FIELDS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'state',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'resource',
] as const;

/** What each scope lets the app do, in plain words. */
const SCOPE_TEXT: Record<string, string> = {
  [SCOPE_READ]: 'See your recipes, search them and find similar ones',
  [SCOPE_WRITE]:
    'Add, edit, tag, favourite and annotate recipes, and change your settings',
};

/** First value of each query parameter. */
function flatten(
  raw: Record<string, string | string[] | undefined>,
): AuthorizeParams {
  const out: AuthorizeParams = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}

/**
 * The screen an assistant sends people to when they connect it: it shows who is
 * asking and what for, and the user approves or declines. Signing in (with
 * Google, as for the rest of the app) happens first if needed, then returns
 * here. The decision is posted to `/oauth/consent`, which re-checks everything.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
      <Panel>
        <Eyebrow>Connect an app</Eyebrow>
        <Heading as="h1" variant="h3" className="mt-2">
          Can&apos;t connect this app
        </Heading>
        <p className="text-ink/75 mt-3 leading-relaxed">{check.description}</p>
        <p className="text-ink/65 mt-5 font-mono text-sm">
          Error: {check.error}
        </p>
      </Panel>
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
      <BarePage>
        <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
          <DriveConnectPanel
            heading="h1"
            reconnect={wasDriveConnected(user)}
            returnTo={here}
          />
        </div>
      </BarePage>
    );
  }

  const { client, redirectUri, scope } = check.request;
  let target = redirectUri;
  try {
    target = new URL(redirectUri).host || new URL(redirectUri).protocol;
  } catch {
    // validated already; show it raw if somehow unparseable
  }

  return (
    <Panel>
      <Eyebrow>Connect an app</Eyebrow>
      <Heading as="h1" variant="h3" className="mt-2 break-words">
        Connect <span className="text-ember">{client.name}</span> to chowdown?
      </Heading>
      <p className="text-ink/75 mt-3">
        Signed in as <span className="font-medium">{user.email}</span>. This app
        will be able to:
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {scope.map((s) => (
          <li key={s} className="flex items-start gap-3">
            <CheckIcon className="text-forest mt-0.5 h-5 w-5 shrink-0" />
            <span className="leading-relaxed">{SCOPE_TEXT[s] ?? s}</span>
          </li>
        ))}
      </ul>
      <p className="rounded-control bg-sand text-ink/80 mt-5 px-4 py-3 text-sm leading-relaxed">
        After you approve, you&apos;ll be sent back to{' '}
        <span className="font-semibold break-all">{target}</span>. Only approve
        apps you trust. You can disconnect it any time from chowdown.
      </p>
      <form action="/oauth/consent" method="post" className="mt-6">
        {FIELDS.map((name) =>
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
    </Panel>
  );
}

/** The approval screen's frame: the bare page with a centred card in it. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <BarePage>
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
        <div className="rounded-card border-ink/10 border bg-white p-6 sm:p-8">
          {children}
        </div>
      </div>
    </BarePage>
  );
}
