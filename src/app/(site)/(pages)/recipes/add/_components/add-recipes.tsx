'use client';

import { useCallback, useRef, useState, type ReactElement } from 'react';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FormField,
  FormMessage,
  TextArea,
  TextInput,
} from '@/components/ui/field';
import { countOf } from '@/lib/intl';
import { problemMessage } from '@/lib/problem-message';

import {
  discardImport,
  postImport,
  postRecipe,
  readImport,
  type ImportDraft,
} from './recipe-requests';

/** Where the wizard is: pasting, stepping through the drafts, or finished. */
type Phase = 'input' | 'review' | 'done';

/** The wizard's heading for each phase. */
const HEADINGS: Readonly<Record<Phase, string>> = {
  input: 'Import links or text',
  review: 'Review your recipes',
  done: 'All done',
};

/**
 * The "Add recipes" wizard. Two phases:
 *
 *  1. **input** — the user pastes a blob of links, markdown and/or free text.
 *     The server fetches the links, converts everything to Cooklang, and hands
 *     back one draft per recipe.
 *  2. **review** — the user steps through the drafts one at a time, editing the
 *     name and Cooklang, and saves each to Drive before moving to the next.
 *
 * Saving reuses POST /api/recipes; `onSaved` runs after each recipe is saved,
 * so the parent can refresh its list.
 */
export function AddRecipes({
  onClose,
  onSaved,
}: Readonly<{
  /** Told when the person is finished with the wizard (Close, or Done). */
  onClose: () => void;
  /** Told after each recipe is saved, so the parent can refresh its list. */
  onSaved: () => void;
}>): ReactElement {
  const [phase, setPhase] = useState<Phase>('input');
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState<readonly ImportDraft[]>([]);
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [cook, setCook] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  /** The import the drafts came from; discarded once the wizard finishes. */
  const importId = useRef<string | null>(null);

  /** Load draft `i` into the editable fields, or finish when past the end. */
  const seek = useCallback((list: readonly ImportDraft[], i: number) => {
    const draft = list[i];
    if (!draft) {
      setPhase('done');
      if (importId.current) {
        // The drafts have been dealt with; tidy the import away.
        discardImport(importId.current);
        importId.current = null;
      }
      return;
    }
    setIndex(i);
    setName(draft.title);
    setCook(draft.cook);
    setError(null);
  }, []);

  const prepare = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postImport(input);
      if (!res.ok) {
        throw new Error(await problemMessage(res));
      }
      const prepared = readImport(await res.json());
      if (!prepared) {
        throw new Error('Could not prepare those recipes.');
      }
      importId.current = prepared.id;
      setDrafts(prepared.drafts);
      setPhase('review');
      seek(prepared.drafts, 0);
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
      const res = await postRecipe(name, cook);
      if (!res.ok) {
        throw new Error(await problemMessage(res));
      }
      setSavedCount((c) => c + 1);
      // Each saved recipe changes the list, even if they stop part-way through.
      onSaved();
      seek(drafts, index + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save that recipe.',
      );
    } finally {
      setBusy(false);
    }
  }, [name, cook, drafts, index, seek, onSaved]);

  const skip = useCallback(
    () => seek(drafts, index + 1),
    [drafts, index, seek],
  );

  const current = drafts[index];

  return (
    <Card as="section" aria-labelledby="add-recipes-heading">
      <div className="flex items-center justify-between gap-4">
        <h2
          id="add-recipes-heading"
          className="font-display text-2xl font-semibold tracking-tight"
        >
          {HEADINGS[phase]}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <CloseIcon size="sm" />
          Close
        </Button>
      </div>

      {phase === 'input' ? (
        <>
          <p className="text-muted mt-2 max-w-2xl leading-relaxed">
            Paste recipe links, markdown, or plain text — mix as many as you
            like. We&apos;ll fetch each link, turn everything into Cooklang, and
            walk you through saving them one at a time.
          </p>
          <div className="mt-5">
            <FormField id="import-input" label="Links or recipe text">
              <TextArea
                id="import-input"
                mono
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={10}
                placeholder={
                  'https://example.com/pasta\nhttps://example.com/curry\n\nor paste a recipe directly…'
                }
              />
            </FormField>
          </div>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <div className="mt-5">
            <Button
              size="lg"
              onClick={prepare}
              disabled={busy || !input.trim()}
              aria-busy={busy}
              className="disabled:opacity-50"
            >
              {busy ? 'Preparing…' : 'Prepare recipes'}
            </Button>
          </div>
        </>
      ) : null}

      {phase === 'review' ? (
        <>
          <p className="text-muted mt-2 font-medium">
            Recipe {index + 1} of {drafts.length}
            {current?.source ? (
              <>
                {' · '}
                <span className="text-subtle break-all">{current.source}</span>
              </>
            ) : null}
          </p>

          {current?.error ? (
            <FormMessage tone="note">{current.error}</FormMessage>
          ) : null}

          <div className="mt-5 flex flex-col gap-5">
            <FormField id="draft-name" label="Recipe name">
              <TextInput
                id="draft-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Recipe name"
              />
            </FormField>
            <FormField
              id="draft-cook"
              label="Cooklang source"
              hint="Paste or edit the recipe here."
            >
              <TextArea
                id="draft-cook"
                mono
                value={cook}
                onChange={(e) => setCook(e.target.value)}
                rows={14}
                spellCheck={false}
                placeholder="Cooklang source — paste or edit the recipe here."
              />
            </FormField>
          </div>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={saveCurrent}
              disabled={busy}
              aria-busy={busy}
              className="disabled:opacity-50"
            >
              {busy
                ? 'Saving…'
                : index + 1 < drafts.length
                  ? 'Save & next'
                  : 'Save & finish'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={skip}
              disabled={busy}
              className="disabled:opacity-50"
            >
              Skip
            </Button>
          </div>
        </>
      ) : null}

      {phase === 'done' ? (
        <>
          <p className="mt-3 text-lg" role="status">
            Saved {countOf(savedCount, 'recipe')} to your Drive.
          </p>
          <div className="mt-5">
            <Button size="lg" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
