'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { requestDeletion } from '@/components/ui/request-deletion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

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
}: Readonly<{
  recipeId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>): ReactElement {
  const router = useRouter();
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Move focus to Cancel (the safe choice) once the dialog is showing.
  useEffect(() => {
    if (open) {
      cancel.current?.focus();
    }
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await requestDeletion(
      `/api/recipes/${recipeId}`,
      "Couldn't delete this recipe. Nothing was changed.",
    );
    setBusy(false);
    if (!result.deleted) {
      setError(result.message);
      return;
    }
    onOpenChange(false);
    // Drop cached pages so the deleted recipe disappears from the list.
    router.push('/app');
    router.refresh();
  };

  return (
    <Dialog
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
      <DialogContent
        variant="center"
        showClose={false}
        dismissable={!busy}
        className="p-6"
      >
        <DialogTitle className="font-display text-xl font-semibold">
          Delete this recipe?
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted">
          <span className="font-semibold text-ink">{title}</span> will be
          removed from chowdown and moved to the trash in your Google Drive,
          where you can restore it for about 30 days.
        </DialogDescription>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-ember">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            // Focus starts on Cancel, the safe choice.
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
      </DialogContent>
    </Dialog>
  );
}
