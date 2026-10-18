'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { problemError, problemText } from '@/lib/problem-message';

/**
 * "Add a note" control on a recipe page. Lets the user attach a personal note
 * to the whole recipe or to a specific ingredient, then refreshes the server
 * component so the note shows inline. The original recipe is never changed;
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
  const field = useRef<HTMLTextAreaElement>(null);

  // The reader opened this form on purpose, so start typing straight away.
  useEffect(() => {
    if (open) {
      field.current?.focus();
    }
  }, [open]);

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
        throw await problemError(res);
      }
      setText('');
      setTarget('');
      setOpen(false);
      router.refresh();
    } catch (error) {
      setError(problemText(error, 'Could not save the note.'));
    } finally {
      setBusy(false);
    }
  }, [text, target, recipeId, router]);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        Add a note
      </Button>
    );
  }

  return (
    <div className="rounded-card border-ink/15 w-full max-w-xl border bg-white p-4">
      <label htmlFor="note-text" className="text-sm font-semibold">
        Your note
      </label>
      <textarea
        id="note-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        ref={field}
        placeholder="e.g. use 3 avocados instead of 2"
        className="rounded-control border-ink/25 focus:border-ink placeholder:text-ink/65 mt-1.5 w-full border bg-white px-3 py-2 text-base outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SelectField
          label="Attach to"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">the whole recipe</option>
          {ingredients.map((name, index) => (
            <option key={`${name}-${index}`} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <div className="ml-auto flex gap-2">
          <Button
            onClick={() => void save()}
            disabled={busy || !text.trim()}
            className="disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save note'}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-ember mt-2 text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
