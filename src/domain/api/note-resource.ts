/**
 * @packageDocumentation
 *
 * Notes on the wire. A note lives as one comment line in the recipe's Cooklang
 * file, so it has no id of its own: its id is its position among the recipe's
 * notes ("1" is the first). Positions shift when an earlier note is deleted, so
 * clients that edit or delete should send the recipe's `ETag` as `If-Match`.
 */

import { flatNoteKey, type Note } from '@/lib/cooklang/cook-text';

/** A note as the API shows it. */
export interface NoteResource {
  readonly id: string;
  readonly scope: 'GENERAL' | 'INGREDIENT' | 'STEP';
  readonly ingredient?: string;
  readonly step?: number;
  readonly text: string;
}

/** How each note scope is spelled on the wire. */
const WIRE_SCOPES = {
  general: 'GENERAL',
  ingredient: 'INGREDIENT',
  step: 'STEP',
} as const satisfies Record<Note['scope'], NoteResource['scope']>;

/** The longest note text accepted. */
const MAX_TEXT = 2000;

/** A note as a resource; `index` is 0-based. */
export function noteResource(
  note: Readonly<Note>,
  index: number,
): NoteResource {
  const base = {
    id: String(index + 1),
    scope: WIRE_SCOPES[note.scope],
    text: note.text,
  };
  if (note.scope === 'ingredient') {
    return { ...base, ingredient: note.key };
  }
  if (note.scope === 'step') {
    return { ...base, step: Number(note.key) };
  }
  return base;
}

/** The 0-based index for a note id, or undefined if it isn't a position. */
export function noteIndex(id: string): number | undefined {
  return /^[1-9]\d{0,5}$/.test(id) ? Number(id) - 1 : undefined;
}

/** A validated note body, or what was wrong with it. */
export type NoteInput =
  | { readonly ok: true; readonly note: Note }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Validate a note request body: `text`, and at most one of `ingredient` (a name)
 * or `step` (a 1-based number). Which of the two is present decides the scope.
 */
export function parseNoteInput(
  body: Readonly<Record<string, unknown>>,
): NoteInput {
  const text = body['text'];
  const ingredient = body['ingredient'];
  const step = body['step'];
  const errors = [
    ...textErrors(text),
    ...(ingredient !== undefined &&
    (typeof ingredient !== 'string' || !ingredient.trim())
      ? ['ingredient: must be a non-empty string.']
      : []),
    ...(step !== undefined && !isPositiveInteger(step)
      ? ['step: must be a whole number from 1.']
      : []),
    ...(typeof ingredient === 'string' &&
    ingredient.trim() &&
    !flatNoteKey(ingredient)
      ? ['ingredient: must contain a name.']
      : []),
    ...(ingredient !== undefined && step !== undefined
      ? ['ingredient and step cannot both be set.']
      : []),
  ];
  if (errors.length > 0 || typeof text !== 'string') {
    return { ok: false, errors };
  }
  if (typeof ingredient === 'string') {
    return {
      ok: true,
      note: {
        scope: 'ingredient',
        key: flatNoteKey(ingredient),
        text: text.trim(),
      },
    };
  }
  if (typeof step === 'number') {
    return {
      ok: true,
      note: { scope: 'step', key: String(step), text: text.trim() },
    };
  }
  return { ok: true, note: { scope: 'general', key: '', text: text.trim() } };
}

/** Whether a value is a whole number of at least 1. */
function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** What is wrong with the `text` member, if anything. */
function textErrors(text: unknown): readonly string[] {
  if (typeof text !== 'string' || !text.trim()) {
    return ['text: required.'];
  }
  return text.length > MAX_TEXT
    ? [`text: at most ${MAX_TEXT} characters.`]
    : [];
}
