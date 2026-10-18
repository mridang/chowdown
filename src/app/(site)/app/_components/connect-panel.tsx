'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

import { relativeTime } from '@/lib/intl';

/** An app the user has connected, as the API returns it. */
interface ConnectedApp {
  id: string;
  name: string;
  scopes: string[];
  connected_at: string;
  last_used_at?: string;
}

/** A copyable line: a label, the value in a code box, and a Copy button. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 flex-none font-semibold text-slate-600">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-slate-700">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="rounded border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** "recipes:read recipes:write" → "can edit" / "read only". */
function accessLabel(scope: string[]): string {
  return scope.includes('recipes:write') ? 'can edit' : 'read only';
}

/**
 * How to connect an assistant, and which ones are connected.
 *
 * The main way is the OAuth server URL: paste it into the assistant, sign in
 * and approve. The older secret link still works and is tucked away under
 * "Connected apps". The list of connected apps is loaded when the section is
 * opened, so it adds nothing to the page's own load time.
 */
export function ConnectPanel({ mcpToken }: { mcpToken: string }) {
  // The page's own address; empty during server rendering, so the markup
  // matches until the browser takes over.
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => '',
  );
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/users/self/connected-apps');
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      setApps(((await res.json()) as { items: ConnectedApp[] }).items);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  const disconnect = useCallback(async (grantId: string) => {
    const res = await fetch(`/api/users/self/connected-apps/${grantId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setApps((current) => current?.filter((a) => a.id !== grantId) ?? null);
    }
  }, []);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
      <CopyRow label="MCP server" value={`${origin}/api/mcp`} />
      <p className="mt-1 pl-30 text-slate-400">
        Add this as a connector in ChatGPT, Claude or any MCP app. You&apos;ll
        be asked to sign in and approve.
      </p>
      <details
        className="mt-2"
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open && apps === null) {
            void load();
          }
        }}
      >
        <summary className="cursor-pointer font-semibold text-slate-600">
          Connected apps &amp; secret link
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {failed ? (
            <p>Couldn&apos;t load your connected apps.</p>
          ) : apps === null ? (
            <p>Loading…</p>
          ) : apps.length === 0 ? (
            <p>No apps connected with sign-in yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {apps.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5"
                >
                  <span className="min-w-0 truncate text-slate-700">
                    <span className="font-medium">{app.name}</span>{' '}
                    <span className="text-slate-400">
                      · {accessLabel(app.scopes)}
                      {app.last_used_at
                        ? ` · last used ${relativeTime(app.last_used_at)}`
                        : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void disconnect(app.id)}
                    className="rounded border border-slate-200 px-2 py-0.5 font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}
          <CopyRow
            label="Secret link"
            value={`${origin}/api/mcp/${mcpToken}`}
          />
          <p className="pl-30 text-slate-400">
            The older way to connect. Anyone with this link can use your
            recipes, so prefer the server URL above.
          </p>
        </div>
      </details>
    </div>
  );
}
