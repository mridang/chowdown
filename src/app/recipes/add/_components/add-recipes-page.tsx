'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { AddRecipes } from '@/app/app/_components/add-recipes';

/** Starter content offered when writing a recipe by hand. */
const STARTER = `>> title: New Recipe
>> servings: 2

Add @your ingredient{1} to a #pan{} and cook for ~{5%minutes}.
`;

type Mode = 'choose' | 'import' | 'manual';

/** The manual "write it yourself" editor. */
function ManualEditor({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [content, setContent] = useState(STARTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!name.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), content }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const created = (await res.json()) as { id: string };
      router.push(`/recipe/${created.id}`);
    } catch {
      setError('Could not save the recipe.');
      setBusy(false);
    }
  }, [name, content, router]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Write a recipe</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipe name (e.g. Pancakes)"
        className="mt-3 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        spellCheck={false}
        className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[13px]"
      />
      {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="rounded-md bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save to Drive'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}

/** A big mode-choice card. */
function ChoiceCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl border border-slate-200 bg-white p-6 text-left transition hover:border-amber-300 hover:shadow-sm"
    >
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </button>
  );
}

/**
 * The add-recipes flow: first choose how (import links/text, or write one by
 * hand), then run that flow. Import reuses the review wizard; writing opens the
 * editor. Both save to Drive and land you on the recipe (or back on the grid).
 */
export function AddRecipesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <nav className="text-sm">
        <Link
          href="/app"
          className="text-slate-500 transition hover:text-slate-900"
        >
          ← All recipes
        </Link>
      </nav>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        Add recipes
      </h1>

      {mode === 'choose' ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ChoiceCard
            title="Import links or text"
            description="Paste recipe links, markdown or plain text — we fetch and convert each one, then you review and save."
            onClick={() => setMode('import')}
          />
          <ChoiceCard
            title="Write it myself"
            description="Type a recipe by hand in Cooklang and save it straight to your Drive."
            onClick={() => setMode('manual')}
          />
        </div>
      ) : null}

      {mode === 'import' ? (
        <div className="mt-6">
          <AddRecipes
            onClose={() => router.push('/app')}
            onSaved={() => undefined}
          />
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="mt-6">
          <ManualEditor onCancel={() => setMode('choose')} />
        </div>
      ) : null}
    </div>
  );
}
