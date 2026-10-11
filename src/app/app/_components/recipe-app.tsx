'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

/** A recipe as summarised by the list API. */
interface RecipeSummary {
  id: string;
  name: string;
  display: string;
  uncurated: boolean;
  modifiedTime: string | null;
}

/** Starter content offered when creating a new recipe. */
const STARTER = `>> title: New Recipe
>> servings: 2

Add @your ingredient{1} to a #pan{} and cook for ~{5%minutes}.
`;

/**
 * The interactive recipe surface: the user's recipe list with search on the
 * left, the rendered recipe (or the new-recipe editor) on the right. All Drive
 * work happens through the `/api/recipes` endpoints, which act as the user
 * server-side — the browser never sees a Drive token.
 */
export function RecipeApp({
  userName,
  mcpToken,
  initialRecipes,
}: {
  userName: string;
  mcpToken: string;
  /** Recipes loaded on the server so the list is present in the SSR HTML. */
  initialRecipes: RecipeSummary[];
}) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeSummary[]>(initialRecipes);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState(STARTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mcpUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/mcp/${mcpToken}`
        : `/api/mcp/${mcpToken}`,
    [mcpToken],
  );

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/recipes');
    if (!res.ok) {
      setError('Could not load your recipes.');
      return;
    }
    const data = (await res.json()) as { recipes: RecipeSummary[] };
    setRecipes(data.recipes);
  }, []);

  // No fetch-on-mount: the list is server-rendered and seeded via props, so
  // there's no loading flash. `load()` is only used to refresh after a create.

  const create = useCallback(async () => {
    if (!newName.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), content: newContent }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const created = (await res.json()) as RecipeSummary;
      setCreating(false);
      setNewName('');
      setNewContent(STARTER);
      await load();
      // Land on the new recipe's server-rendered page.
      router.push(`/recipe/${created.id}`);
    } catch {
      setError('Could not save the recipe.');
    } finally {
      setBusy(false);
    }
  }, [newName, newContent, load, router]);

  const copyMcp = useCallback(() => {
    void navigator.clipboard?.writeText(mcpUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [mcpUrl]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return recipes;
    }
    return recipes.filter((r) => r.display.toLowerCase().includes(q));
  }, [recipes, query]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            🍳 chowdown
          </span>
          <span className="text-sm text-slate-400">· {userName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            + New recipe
          </button>
          <a
            href="/api/auth/logout"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Sign out
          </a>
        </div>
      </header>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
        <span className="font-semibold text-slate-600">Your MCP link</span>
        <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-slate-700">
          {mcpUrl}
        </code>
        <button
          type="button"
          onClick={copyMcp}
          className="rounded border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-[13px] text-red-600">{error}</p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[18rem_1fr]">
        <aside>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes…"
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <ul className="mt-3 flex flex-col">
            {filtered.length === 0 ? (
              <li className="px-1 py-2 text-sm text-slate-400">
                {recipes.length === 0
                  ? 'No recipes yet — create your first one.'
                  : 'No matches.'}
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/recipe/${item.id}`}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.display}</span>
                    {item.uncurated ? (
                      <span className="flex-none rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                        idea
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="min-w-0">
          {creating ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">New recipe</h2>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Recipe name (e.g. Pancakes)"
                className="mt-3 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={10}
                spellCheck={false}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[13px]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={create}
                  disabled={busy || !newName.trim()}
                  className="rounded-md bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save to Drive'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-md border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-16 text-center text-slate-400">
              Pick a recipe, or create a new one.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
