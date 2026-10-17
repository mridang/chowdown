import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/current-user';
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
        <h1 className="text-lg font-semibold text-slate-900">
          Can&apos;t connect this app
        </h1>
        <p className="mt-2 text-sm text-slate-600">{check.description}</p>
        <p className="mt-4 text-xs text-slate-400">Error: {check.error}</p>
      </Panel>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ).toString();
    redirect(
      `/api/auth/login?returnTo=${encodeURIComponent(`/oauth/authorize?${query}`)}`,
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
      <h1 className="text-lg font-semibold text-slate-900">
        Connect <span className="text-amber-700">{client.name}</span> to
        chowdown?
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as {user.email}. This app will be able to:
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
        {scope.map((s) => (
          <li key={s} className="flex gap-2">
            <span aria-hidden="true">✓</span>
            <span>{SCOPE_TEXT[s] ?? s}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        After you approve, you&apos;ll be sent back to{' '}
        <span className="font-medium text-slate-700">{target}</span>. Only
        approve apps you trust. You can disconnect it any time from chowdown.
      </p>
      <form action="/oauth/consent" method="post" className="mt-5">
        {FIELDS.map((name) =>
          params[name] === undefined ? null : (
            <input key={name} type="hidden" name={name} value={params[name]} />
          ),
        )}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            name="decision"
            value="deny"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            name="decision"
            value="approve"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            Approve
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** A centred card. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </div>
  );
}
