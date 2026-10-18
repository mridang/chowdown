'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

/**
 * "Auto-tag" button on a recipe page. Posts to the tag endpoint (Workers AI
 * classifies against the curated taxonomy and writes the tags into the `.cook`
 * file), then refreshes the server component so the new tags show in the
 * metadata row. A small client island over the SSR page.
 */
export function TagButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const tag = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/rpc/tag-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const data = (await res.json()) as { tagged: boolean };
      if (data.tagged) {
        router.refresh();
      } else {
        setNote("Couldn't tag this one.");
      }
    } catch {
      setNote('Tagging failed.');
    } finally {
      setBusy(false);
    }
  }, [recipeId, router]);

  return (
    <div className="flex items-center gap-2">
      {note ? <span className="text-xs text-slate-400">{note}</span> : null}
      <button
        type="button"
        onClick={tag}
        disabled={busy}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? 'Tagging…' : 'Auto-tag'}
      </button>
    </div>
  );
}
