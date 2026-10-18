'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Delete" button on a recipe page. It opens a confirmation dialog (a native
 * `<dialog>`, so focus trapping and Escape come for free, and focus starts on
 * Cancel, the safe choice) and only deletes when
 * the user confirms. The recipe goes to the Drive trash, so it can be restored
 * from there. On success the user returns to the list.
 */
export function DeleteButton({
  recipeId,
  title,
}: {
  recipeId: string;
  title: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the page quiet while a delete is in flight: Escape must not close the
  // dialog and leave the request running unseen.
  useEffect(() => {
    const el = dialog.current;
    if (!el) {
      return;
    }
    const block = (event: Event) => {
      if (busy) {
        event.preventDefault();
      }
    };
    el.addEventListener('cancel', block);
    return () => el.removeEventListener('cancel', block);
  }, [busy]);

  const open = useCallback(() => {
    setError(null);
    dialog.current?.showModal();
  }, []);

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      dialog.current?.close();
      // Drop cached pages so the deleted recipe disappears from the list.
      router.push('/app');
      router.refresh();
    } catch {
      setError("Couldn't delete this recipe. Nothing was changed.");
      setBusy(false);
    }
  }, [recipeId, router]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        Delete
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="p-5">
          <h2
            id="delete-title"
            className="text-base font-semibold text-slate-900"
          >
            Delete this recipe?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium">{title}</span> will be removed from
            chowdown and moved to the trash in your Google Drive, where you can
            restore it for about 30 days.
          </p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => dialog.current?.close()}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete recipe'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
