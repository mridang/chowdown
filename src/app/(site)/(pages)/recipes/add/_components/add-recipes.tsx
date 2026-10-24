'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FormField,
  FormMessage,
  TextArea,
  TextInput,
} from '@/components/ui/field';
import { useFocusOnChange } from '@/components/ui/use-focus-on-change';
import { countOf } from '@/lib/intl';
import { problemMessage } from '@/lib/problem-message';

import {
  ANNOUNCEMENTS,
  missingFieldErrors,
  prepareImport,
  type Phase,
} from '@/app/(site)/(pages)/recipes/add/_components/import-flow';
import {
  discardImport,
  postRecipe,
  type ImportDraft,
} from '@/app/(site)/(pages)/recipes/add/_components/recipe-requests';
import { SHARED_HINT } from '@/app/(site)/(pages)/recipes/add/_components/shared-input';

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
 *
 * Each phase replaces the one before, taking the button that was pressed with
 * it, so focus moves to the new phase's heading (otherwise it falls back to the
 * top of the page and a screen reader says nothing). Preparing can run for
 * minutes, so it announces itself in a live region and can be cancelled.
 */
export function AddRecipes({
  initialInput = '',
  onClose,
  onSaved,
}: Readonly<{
  /**
   * Text to start the box with: a link or recipe shared to the installed app.
   * When present the box takes focus, but nothing is prepared until the person
   * presses the button, because preparing spends AI budget.
   */
  initialInput?: string;
  /** Told when the person is finished with the wizard (Close, or Done). */
  onClose: () => void;
  /** Told after each recipe is saved, so the parent can refresh its list. */
  onSaved: () => void;
}>): ReactElement {
  const [phase, setPhase] = useState<Phase>('input');
  const [input, setInput] = useState(initialInput);
  const [drafts, setDrafts] = useState<readonly ImportDraft[]>([]);
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [cook, setCook] = useState('');
  const [busy, setBusy] = useState(false);
  /** Why the pasted text could not be prepared; shown with the text box. */
  const [prepareError, setPrepareError] = useState<string | null>(null);
  /** Why a recipe could not be saved (the server's words); shown under the form. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Whether Save was pressed on this draft, which is when empty fields become errors. */
  const [attempted, setAttempted] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  /** What the live region says, for screen readers. */
  const [announcement, setAnnouncement] = useState('');
  /** The import the drafts came from; discarded once the wizard finishes. */
  const importId = useRef<string | null>(null);
  /** The request being waited on, so Cancel (or leaving) can end it. */
  const inflight = useRef<AbortController | null>(null);
  const heading = useFocusOnChange<HTMLHeadingElement>(phase, null);
  /** The box the person pastes into; focused straight away when it arrives filled in. */
  const inputBox = useRef<HTMLTextAreaElement>(null);

  // A share arrives with the box already filled in. Put the person in it, ready
  // to read what came and press the button, but do not press it for them.
  useEffect(() => {
    if (initialInput) {
      inputBox.current?.focus();
    }
  }, [initialInput]);

  // Leaving the page ends a request nobody is waiting for any more.
  useEffect(() => {
    const pending = inflight;
    return () => pending.current?.abort();
  }, []);

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
    setSaveError(null);
    setAttempted(false);
  }, []);

  const prepare = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    const controller = new AbortController();
    inflight.current = controller;
    setBusy(true);
    setPrepareError(null);
    setAnnouncement(ANNOUNCEMENTS.preparing);
    const outcome = await prepareImport(input, controller.signal);
    inflight.current = null;
    setBusy(false);
    switch (outcome.kind) {
      case 'cancelled':
        setAnnouncement(ANNOUNCEMENTS.cancelled);
        return;
      case 'failed':
        setAnnouncement('');
        setPrepareError(outcome.message);
        return;
      case 'prepared':
        setAnnouncement('');
        importId.current = outcome.prepared.id;
        setDrafts(outcome.prepared.drafts);
        setPhase('review');
        seek(outcome.prepared.drafts, 0);
    }
  }, [input, seek]);

  /** Give up on the import being prepared; the pasted text is kept. */
  const cancel = useCallback(() => inflight.current?.abort(), []);

  const saveCurrent = useCallback(async () => {
    if (Object.keys(missingFieldErrors(name, cook)).length > 0) {
      setAttempted(true);
      return;
    }
    setBusy(true);
    setSaveError(null);
    setAnnouncement(ANNOUNCEMENTS.saving);
    try {
      const res = await postRecipe(name, cook);
      if (!res.ok) {
        throw new Error(await problemMessage(res));
      }
      setSavedCount((c) => c + 1);
      // Each saved recipe changes the list, even if they stop part-way through.
      onSaved();
      seek(drafts, index + 1);
      setAnnouncement(
        index + 1 < drafts.length
          ? ANNOUNCEMENTS.savedNext(index + 2, drafts.length)
          : '',
      );
    } catch (err) {
      setAnnouncement('');
      setSaveError(
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
  // Empty fields only count as errors once Save has been pressed, and stop
  // counting as soon as they are filled in.
  const fieldErrors = attempted ? missingFieldErrors(name, cook) : {};

  return (
    <Card as="section" aria-labelledby="add-recipes-heading">
      <div className="flex items-center justify-between gap-4">
        <h2
          ref={heading}
          // Focusable by script only, so focus can be moved here between steps.
          tabIndex={-1}
          id="add-recipes-heading"
          className="font-display text-2xl font-semibold tracking-tight outline-none"
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
          <p className="mt-2 max-w-2xl leading-relaxed text-muted">
            Paste recipe links, markdown, or plain text — mix as many as you
            like. We&apos;ll fetch each link, turn everything into Cooklang, and
            walk you through saving them one at a time.
          </p>
          <div className="mt-5">
            <FormField
              id="import-input"
              label="Links or recipe text"
              hint={initialInput ? SHARED_HINT : undefined}
              error={prepareError ?? undefined}
            >
              <TextArea
                id="import-input"
                ref={inputBox}
                mono
                grow
                className="[--autogrow-rows:8]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={10}
                placeholder={
                  'https://example.com/pasta\nhttps://example.com/curry\n\nor paste a recipe directly…'
                }
              />
            </FormField>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={prepare}
              disabled={busy || !input.trim()}
              aria-busy={busy}
              className="disabled:opacity-50"
            >
              {busy ? 'Preparing…' : 'Prepare recipes'}
            </Button>
            {busy ? (
              <Button variant="outline" size="lg" onClick={cancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === 'review' ? (
        <>
          <p className="mt-2 font-medium text-muted">
            Recipe {index + 1} of {drafts.length}
            {current?.source ? (
              <>
                {' · '}
                <span className="break-all text-subtle">{current.source}</span>
              </>
            ) : null}
          </p>

          {current?.error ? (
            <FormMessage tone="note">{current.error}</FormMessage>
          ) : null}

          <div className="mt-5 flex flex-col gap-5">
            <FormField
              id="draft-name"
              label="Recipe name"
              error={fieldErrors.name}
            >
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
              error={fieldErrors.cook}
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
          {saveError ? (
            <FormMessage tone="error">{saveError}</FormMessage>
          ) : null}
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

      {/* Always present, so screen readers are already listening when it fills. */}
      <p
        role="status"
        aria-live="polite"
        className="mt-4 text-sm text-muted empty:hidden"
      >
        {announcement}
      </p>
    </Card>
  );
}
