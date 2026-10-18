'use client';

import { useCallback, useEffect, useState } from 'react';

import { PlugIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { accessLabel, type ConnectedApp } from '@/lib/connected-apps';
import { relativeTime } from '@/lib/intl';

/**
 * The assistants that have been given access with sign-in, each with a
 * Disconnect button. The list loads in the browser once the page is up, so it
 * adds nothing to the page's own load time; disconnecting an app revokes its
 * tokens at once and drops it from the list.
 */
export function ConnectedApps() {
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** The app currently being disconnected, and a message if that fails. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/users/self/connected-apps')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(String(res.status));
        }
        return ((await res.json()) as { items: ConnectedApp[] }).items;
      })
      .then((items) => {
        if (live) {
          setApps(items);
        }
      })
      .catch(() => {
        if (live) {
          setFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const disconnect = useCallback(async (grantId: string) => {
    setBusyId(grantId);
    setProblem(null);
    try {
      const res = await fetch(`/api/users/self/connected-apps/${grantId}`, {
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
      <p className="text-ink/75 mt-5">Could not load your connected apps.</p>
    );
  }
  if (apps === null) {
    return (
      <p className="text-ink/65 mt-5" role="status">
        Loading…
      </p>
    );
  }
  if (apps.length === 0) {
    return (
      <p className="text-ink/75 mt-5 max-w-md leading-relaxed">
        No assistants are connected yet. Once you add the address and approve
        access, they will appear here.
      </p>
    );
  }
  return (
    <>
      <ul className="mt-5 flex flex-col gap-3">
        {apps.map((app) => (
          <li
            key={app.id}
            className="rounded-card border-ink/10 flex items-center justify-between gap-4 border bg-white p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-control bg-ink/5 grid h-10 w-10 shrink-0 place-items-center">
                <PlugIcon className="h-5 w-5" />
              </span>
              <p className="min-w-0 leading-tight">
                <span className="block truncate font-semibold">{app.name}</span>
                <span className="text-ink/70 block text-sm">
                  {accessLabel(app.scopes)}
                  {app.last_used_at
                    ? ` · last used ${relativeTime(app.last_used_at)}`
                    : ''}
                </span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busyId === app.id}
              aria-label={`Disconnect ${app.name}`}
              onClick={() => void disconnect(app.id)}
            >
              {busyId === app.id ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </li>
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
