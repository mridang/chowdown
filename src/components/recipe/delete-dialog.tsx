'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * The confirmation that stands between a tap on "Delete recipe" and the recipe
 * going. It is a small centred dialog (focus is trapped, Escape and the backdrop
 * cancel, and focus starts on Cancel, the safe choice) that only deletes when
 * the user confirms. The recipe moves to the Drive trash, so it can be restored
 * from there. On success the user returns to the list.
 *
 * It is controlled by its parent, because it is opened from a menu item that
 * unmounts as soon as the menu closes.
 */
export function DeleteDialog({
  recipeId,
  title,
  open,
  onOpenChange,
}: {
  recipeId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      onOpenChange(false);
      // Drop cached pages so the deleted recipe disappears from the list.
      router.push('/app');
      router.refresh();
    } catch {
      setError("Couldn't delete this recipe. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      // Keep the dialog up while a delete is in flight, so the request is never
      // left running unseen behind a closed dialog.
      onOpenChange={(next) => {
        if (!busy) {
          setError(null);
          onOpenChange(next);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-ink/50 fixed inset-0 z-40" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel.current?.focus();
          }}
          className="rounded-card text-ink fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 bg-white p-6 outline-none"
        >
          <DialogPrimitive.Title className="font-display text-xl font-semibold">
            Delete this recipe?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-ink/75 mt-2 text-sm leading-relaxed">
            <span className="text-ink font-semibold">{title}</span> will be
            removed from chowdown and moved to the trash in your Google Drive,
            where you can restore it for about 30 days.
          </DialogPrimitive.Description>
          {error ? (
            <p role="alert" className="text-ember mt-3 text-sm font-medium">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              ref={cancel}
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? 'Deleting…' : 'Delete recipe'}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
