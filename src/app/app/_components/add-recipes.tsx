'use client';

import { useCallback, useRef, useState } from 'react';

import { countOf } from '@/lib/intl';
import { problemMessage } from '@/lib/problem-message';

/** A prepared, not-yet-saved recipe, from an item of POST /api/recipe-imports. */
interface ImportDraft {
  title: string;
  cook: string;
  source?: string;
  error?: string;
}

type Phase = 'input' | 'review' | 'done';

/**
 * The "Add recipes" wizard. Two phases:
 *
 *  1. **input** — the user pastes a blob of links, markdown and/or free text.
 *     The server fetches the links, converts everything to Cooklang, and hands
 *     back one draft per recipe.
 *  2. **review** — the user steps through the drafts one at a time, editing the
 *     name and Cooklang, and saves each to Drive before moving to the next.
 *
 * Saving reuses POST /api/recipes; `onSaved` lets the parent refresh its list.
 */
export function AddRecipes({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('input');
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [cook, setCook] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  /** The import the drafts came from; discarded once the wizard finishes. */
  const importId = useRef<string | null>(null);

  /** Load draft `i` into the editable fields, or finish when past the end. */
  const seek = useCallback(
    (list: ImportDraft[], i: number) => {
      if (i >= list.length) {
        setPhase('done');
        onSaved();
        if (importId.current) {
          // The drafts have been dealt with; tidy the import away.
          void fetch(`/api/recipe-imports/${importId.current}`, {
            method: 'DELETE',
          });
          importId.current = null;
        }
        return;
      }
      setIndex(i);
      setName(list[i]!.title);
      setCook(list[i]!.cook);
      setError(null);
    },
    [onSaved],
  );

  const prepare = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recipe-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) {
        throw new Error(await problemMessage(res));
      }
      const created = (await res.json()) as {
        id: string;
        items: {
          title: string;
          cooklang?: string;
          source_url?: string;
          problem?: string;
        }[];
      };
      importId.current = created.id;
      const prepared: ImportDraft[] = created.items.map((item) => ({
        title: item.title,
        cook: item.cooklang ?? '',
        source: item.source_url,
        error: item.problem,
      }));
      setDrafts(prepared);
      setPhase('review');
      seek(prepared, 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not prepare those recipes.',
      );
    } finally {
      setBusy(false);
    }
  }, [input, seek]);

  const saveCurrent = useCallback(async () => {
    if (!name.trim() || !cook.trim()) {
      setError('A name and some Cooklang are needed to save.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cooklang: cook }),
      });
      if (!res.ok) {
        throw new Error(await problemMessage(res));
      }
      setSavedCount((c) => c + 1);
      seek(drafts, index + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save that recipe.',
      );
    } finally {
      setBusy(false);
    }
  }, [name, cook, drafts, index, seek]);

  const skip = useCallback(
    () => seek(drafts, index + 1),
    [drafts, index, seek],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Add recipes</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      {phase === 'input' ? (
        <>
          <p className="mt-2 text-[13px] text-slate-500">
            Paste recipe links, markdown, or plain text — mix as many as you
            like. We&apos;ll fetch each link, turn everything into Cooklang, and
            walk you through saving them one at a time.
          </p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={
              'https://example.com/pasta\nhttps://example.com/curry\n\nor paste a recipe directly…'
            }
            className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[13px]"
          />
          {error ? (
            <p className="mt-2 text-[13px] text-red-600">{error}</p>
          ) : null}
          <div className="mt-3">
            <button
              type="button"
              onClick={prepare}
              disabled={busy || !input.trim()}
              className="rounded-md bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? 'Preparing…' : 'Prepare recipes'}
            </button>
          </div>
        </>
      ) : null}

      {phase === 'review' ? (
        <>
          <p className="mt-2 text-[13px] font-medium text-slate-500">
            Recipe {index + 1} of {drafts.length}
            {drafts[index]?.source ? (
              <>
                {' · '}
                <span className="text-slate-400">{drafts[index]!.source}</span>
              </>
            ) : null}
          </p>

          {drafts[index]?.error ? (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              {drafts[index]!.error}
            </p>
          ) : null}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name"
            className="mt-3 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <textarea
            value={cook}
            onChange={(e) => setCook(e.target.value)}
            rows={14}
            spellCheck={false}
            placeholder="Cooklang source — paste or edit the recipe here."
            className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-[13px]"
          />
          {error ? (
            <p className="mt-2 text-[13px] text-red-600">{error}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveCurrent}
              disabled={busy}
              className="rounded-md bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {busy
                ? 'Saving…'
                : index + 1 < drafts.length
                  ? 'Save & next'
                  : 'Save & finish'}
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={busy}
              className="rounded-md border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </>
      ) : null}

      {phase === 'done' ? (
        <>
          <p className="mt-3 text-sm text-slate-700">
            Saved {countOf(savedCount, 'recipe')} to your Drive.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Done
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
