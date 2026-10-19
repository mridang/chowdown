'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import { deleteAccount } from './delete-account';

/**
 * The confirmation in front of "Delete account". It says plainly what goes
 * (everything chowdown keeps) and what stays (the recipe files in the person's
 * own Drive), and starts with focus on Cancel, the safe choice. While the
 * request is running it cannot be dismissed, so the deletion is never left
 * going on unseen behind a closed dialog. When it succeeds the page is replaced
 * by the home page: the session is already gone, so there is nowhere signed-in
 * to return to.
 *
 * It is controlled by its parent, because it is opened from a menu item that
 * unmounts as soon as the menu closes.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>): ReactElement {
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
    const result = await deleteAccount();
    if (result.deleted) {
      // A full load, not a client navigation: nothing cached about the
      // signed-in person should survive their account.
      window.location.assign('/');
      return;
    }
    setError(result.message);
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
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
          Delete your account?
        </DialogTitle>
        <DialogDescription className="text-muted mt-2 text-sm leading-relaxed">
          This removes everything chowdown keeps about you: your sign-in, the
          saved copy of your recipes, favourites, search index, connected
          assistants and any imports in progress. Your recipe files stay in your
          Google Drive, untouched. This cannot be undone.
        </DialogDescription>
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
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
