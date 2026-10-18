'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

/**
 * "Add a note" control on a recipe page. Lets the user attach a personal note
 * to the whole recipe or to a specific ingredient, then refreshes the server
 * component so the note shows inline. The original recipe is never changed —
 * notes are additive (see appendNote).
 */
export function AddNote({
  recipeId,
  ingredients,
}: {
  recipeId: string;
  /** Ingredient names, to offer as note targets. */
  ingredients: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [target, setTarget] = useState(''); // '' = general, else ingredient name
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!text.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          ingredient: target || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      setText('');
      setTarget('');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not save the note.');
    } finally {
      setBusy(false);
    }
  }, [text, target, recipeId, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Add a note
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        autoFocus
        placeholder="e.g. use 3 avocados instead of 2"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500">Attach to</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        >
          <option value="">the whole recipe</option>
          {ingredients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !text.trim()}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save note'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
    </div>
  );
}
