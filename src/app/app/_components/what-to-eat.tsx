'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

/** A suggested recipe returned by POST /api/suggest. */
interface Suggestion {
  id: string;
  title: string;
}

const EXAMPLES = [
  'something quick with chicken, no oven',
  'a comforting vegetarian dinner',
  'Indian, easy, and a bit spicy',
];

/**
 * The "what do you feel like?" box on the app home. Runs a natural-language
 * semantic search over the user's recipes (Workers AI embeddings) and lists the
 * best matches as links to their pages. A friendly front door to the same RAG
 * the MCP `find_recipes` tool uses.
 */
export function WhatToEat() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const data = (await res.json()) as { results: Suggestion[] };
      setResults(data.results);
    } catch {
      setError('Could not search just now — try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-xl pt-10 text-center">
      <h2 className="text-lg font-semibold text-slate-900">
        What do you feel like?
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Describe a craving and I&apos;ll find the closest recipes you have.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. something warming with lentils"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? 'Thinking…' : 'Find'}
        </button>
      </form>

      {results === null && !busy ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                void search(ex);
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-50"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}

      {results !== null ? (
        <div className="mt-6 text-left">
          {results.length === 0 ? (
            <p className="text-center text-sm text-slate-400">
              Nothing close yet — add more recipes and try again.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/recipe/${r.id}`}
                    className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
