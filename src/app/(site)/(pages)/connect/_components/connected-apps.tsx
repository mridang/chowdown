'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { PlugIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { accessLabel, type ConnectedApp } from '@/lib/connected-apps';
import { relativeTime } from '@/lib/intl';

/** Whether a value has the members of a {@link ConnectedApp} that this list shows. */
function isConnectedApp(value: unknown): value is ConnectedApp {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'scopes' in value &&
    Array.isArray(value.scopes)
  );
}

/** The apps in the answer of `GET /api/users/self/connections`; anything unreadable is left out. */
function appsOf(body: unknown): readonly ConnectedApp[] {
  return typeof body === 'object' &&
    body !== null &&
    'items' in body &&
    Array.isArray(body.items)
    ? body.items.filter(isConnectedApp)
    : [];
}

/**
 * One connected app: its name, how much it may do (the widest of its installs,
 * with the number of installs when there is more than one), who published it
 * (a domain, or "unverified" for an app that registered itself without any
 * check, so two apps with the same name can be told apart), when it was last
 * used, and a button that disconnects all its installs.
 */
export function ConnectedAppItem({
  app,
  busy,
  onDisconnect,
}: Readonly<{
  app: ConnectedApp;
  busy: boolean;
  onDisconnect: () => void;
}>): ReactElement {
  return (
    <Card
      as="li"
      padding="sm"
      className="flex items-center justify-between gap-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-ink/5">
          <PlugIcon size="md" />
        </span>
        <p className="min-w-0 leading-tight">
          <span className="block truncate font-semibold">{app.name}</span>
          <span className="block text-sm text-muted">
            {accessLabel(app.scopes, app.installs)}
            {` · ${app.domain ?? 'unverified'}`}
            {app.last_used_at
              ? ` · last used ${relativeTime(app.last_used_at)}`
              : ''}
          </span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label={`Disconnect ${app.name}`}
        onClick={onDisconnect}
      >
        {busy ? 'Disconnecting…' : 'Disconnect'}
      </Button>
    </Card>
  );
}

/**
 * The assistants that have been given access with sign-in, each with a
 * Disconnect button. The list loads in the browser once the page is up, so it
 * adds nothing to the page's own load time; disconnecting an app revokes its
 * tokens at once and drops it from the list.
 */
export function ConnectedApps(): ReactElement {
  const [apps, setApps] = useState<readonly ConnectedApp[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** The app currently being disconnected, and a message if that fails. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // Leaving the page cancels the request, and a cancelled request must not
    // set state on a component that has gone.
    const controller = new AbortController();
    fetch('/api/users/self/connections', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(String(res.status));
        }
        return appsOf(await res.json());
      })
      .then((items) => {
        if (!controller.signal.aborted) {
          setApps(items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, []);

  const disconnect = useCallback(async (grantId: string) => {
    setBusyId(grantId);
    setProblem(null);
    try {
      const res = await fetch(`/api/users/self/connections/${grantId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      setApps((current) => current?.filter((a) => a.id !== grantId) ?? null);
    } catch {
      setProblem('Could not disconnect that app. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  if (failed) {
    return (
      <p className="mt-5 text-muted">Could not load your connected apps.</p>
    );
  }
  if (apps === null) {
    return (
      <p className="mt-5 text-subtle" role="status">
        Loading…
      </p>
    );
  }
  if (apps.length === 0) {
    return (
      <p className="mt-5 max-w-md leading-relaxed text-muted">
        No assistants are connected yet. Once you add the address and approve
        access, they will appear here.
      </p>
    );
  }
  return (
    <>
      <ul className="mt-5 flex flex-col gap-3">
        {apps.map((app) => (
          <ConnectedAppItem
            key={app.id}
            app={app}
            busy={busyId === app.id}
            onDisconnect={() => void disconnect(app.id)}
          />
        ))}
      </ul>
      {problem ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}
