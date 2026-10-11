'use client';

import { useCallback, useState } from 'react';

/**
 * The heart toggle on a recipe page — a small client island over the otherwise
 * server-rendered page. It's optimistic: it flips immediately, posts the new
 * state, and rolls back if the request fails, so a heart feels instant.
 */
export function HeartButton({
  recipeId,
  initial,
}: {
  recipeId: string;
  /** Whether the user has already hearted this recipe (server-resolved). */
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    const next = !on;
    setOn(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/favourite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: next }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const data = (await res.json()) as { favourite: boolean };
      setOn(data.favourite);
    } catch {
      setOn(!next); // roll back on failure
    } finally {
      setBusy(false);
    }
  }, [on, recipeId]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? 'Remove from favourites' : 'Add to favourites'}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
        on
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      {on ? 'Favourited' : 'Favourite'}
    </button>
  );
}
