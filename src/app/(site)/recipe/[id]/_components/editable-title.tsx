'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type SubmitEvent,
} from 'react';

import { PencilIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { TextInput } from '@/components/ui/field';
import { Heading } from '@/components/ui/layout';

import { patchTitle } from '@/app/(site)/recipe/[id]/_components/title-request';

/** What to say when the box is emptied and saved. */
const EMPTY_TITLE = 'The title cannot be empty.';

/**
 * The recipe's title, which the person can rename on the spot. A small pen
 * appears beside it on hover or keyboard focus (always, on a touch screen,
 * which has no hover); pressing it swaps the title for a text box. Enter or
 * Save keeps the new title, Escape or Cancel drops it, and clicking elsewhere
 * leaves the box open so a half-written title is never lost without a word.
 *
 * The heading stays in the page the whole time (hidden from sight but not from
 * a screen reader while the box is open), so the page always has its one
 * level-one heading. Saving sends the recipe's `etag` as `If-Match`, so a title
 * is never written over a recipe that changed elsewhere, and refreshes the page
 * data so the new title shows everywhere.
 */
export function EditableTitle({
  recipeId,
  title,
  etag,
}: Readonly<{
  recipeId: string;
  /** The title, already cleaned for display. */
  title: string;
  /** The recipe's entity tag as the page loaded it. */
  etag: string;
}>): ReactElement {
  const router = useRouter();
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const field = useRef<HTMLInputElement>(null);
  const pen = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The title just saved, shown until the refreshed page brings the same one.
  const [renamed, setRenamed] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const shown = renamed?.from === title ? renamed.to : title;

  // Put the cursor in the box (text selected) when it opens, and hand focus
  // back to the pen when it closes, so the keyboard never loses its place.
  useEffect(() => {
    if (editing) {
      field.current?.focus();
      field.current?.select();
    } else if (wasEditing.current) {
      pen.current?.focus();
    } else {
      // Nothing to hand back: the box was never open.
    }
    wasEditing.current = editing;
  }, [editing]);

  const open = () => {
    setDraft(shown);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setError(null);
    setEditing(false);
  };

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    const next = draft.trim();
    if (next === shown) {
      cancel();
      return;
    }
    if (!next) {
      setError(EMPTY_TITLE);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await patchTitle(recipeId, next, etag);
    setBusy(false);
    if (!result.saved) {
      setError(result.message);
      return;
    }
    setRenamed({ from: title, to: next });
    setEditing(false);
    router.refresh();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div className="group mt-3">
      <div className={cn('flex items-start gap-3', editing && 'sr-only')}>
        <Heading as="h1" variant="h1" className="min-w-0 lg:text-6xl">
          {shown}
        </Heading>
        {editing ? null : (
          <button
            ref={pen}
            type="button"
            aria-label="Edit title"
            onClick={open}
            // Always there for a touch screen; with a mouse it waits for the
            // pointer, or for focus anywhere in the title.
            className="focus-ring mt-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-subtle transition hover:bg-ink/5 hover:text-ink lg:mt-3 print:hidden pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
          >
            <PencilIcon size="md" />
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="print:hidden">
          <label htmlFor={inputId} className="sr-only">
            Recipe title
          </label>
          <TextInput
            ref={field}
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-auto py-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          />
          {error ? (
            <p id={errorId} role="alert" className="mt-2 text-sm text-ember">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
