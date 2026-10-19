'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  FormField,
  FormMessage,
  SelectField,
  TextArea,
} from '@/components/ui/field';

import { postNote } from './note-request';

/**
 * "Add a note" control on a recipe page. Lets the user attach a personal note
 * to the whole recipe or to a specific ingredient, then refreshes the server
 * component so the note shows inline. The original recipe is never changed;
 * notes are additive (see appendNote).
 */
export function AddNote({
  recipeId,
  ingredients,
}: Readonly<{
  recipeId: string;
  /** Ingredient names, to offer as note targets. */
  ingredients: readonly string[];
}>): ReactElement {
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
    const result = await postNote(recipeId, text, target);
    setBusy(false);
    if (!result.saved) {
      setError(result.message);
      return;
    }
    setText('');
    setTarget('');
    setOpen(false);
    router.refresh();
  }, [text, target, recipeId, router]);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon size="sm" />
        Add a note
      </Button>
    );
  }

  return (
    <div className="rounded-card border-line w-full max-w-xl border bg-white p-4">
      <FormField id="note-text" label="Your note">
        <TextArea
          id="note-text"
          grow
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          ref={field}
          placeholder="e.g. use 3 avocados instead of 2"
        />
      </FormField>
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
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
