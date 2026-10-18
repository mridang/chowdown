/**
 * @packageDocumentation
 *
 * Notes on the wire. A note lives as one comment line in the recipe's Cooklang
 * file, so it has no id of its own: its id is its position among the recipe's
 * notes ("1" is the first). Positions shift when an earlier note is deleted, so
 * clients that edit or delete should send the recipe's `ETag` as `If-Match`.
 */

import type { Note } from '../recipe/cook-text';

/** A note as the API shows it. */
export interface NoteResource {
  id: string;
  scope: 'GENERAL' | 'INGREDIENT' | 'STEP';
  ingredient?: string;
  step?: number;
  text: string;
}

/** The longest note text accepted. */
const MAX_TEXT = 2000;

/** A note as a resource; `index` is 0-based. */
export function noteResource(note: Note, index: number): NoteResource {
  const resource: NoteResource = {
    id: String(index + 1),
    scope: note.scope.toUpperCase() as NoteResource['scope'],
    text: note.text,
  };
  if (note.scope === 'ingredient') {
    resource.ingredient = note.key;
  } else if (note.scope === 'step') {
    resource.step = Number(note.key);
  }
  return resource;
}

/** The 0-based index for a note id, or undefined if it isn't a position. */
export function noteIndex(id: string): number | undefined {
  return /^[1-9]\d{0,5}$/.test(id) ? Number(id) - 1 : undefined;
}

/** A validated note body, or what was wrong with it. */
export type NoteInput =
  | { ok: true; note: Note }
  | { ok: false; errors: string[] };

/**
 * Validate a note request body: `text`, and at most one of `ingredient` (a name)
 * or `step` (a 1-based number). Which of the two is present decides the scope.
 */
export function parseNoteInput(body: Record<string, unknown>): NoteInput {
  const errors: string[] = [];
  const text = body['text'];
  if (typeof text !== 'string' || !text.trim()) {
    errors.push('text: required.');
  } else if (text.length > MAX_TEXT) {
    errors.push(`text: at most ${MAX_TEXT} characters.`);
  }
  const ingredient = body['ingredient'];
  const step = body['step'];
  if (
    ingredient !== undefined &&
    (typeof ingredient !== 'string' || !ingredient.trim())
  ) {
    errors.push('ingredient: must be a non-empty string.');
  }
  if (step !== undefined && (!Number.isInteger(step) || (step as number) < 1)) {
    errors.push('step: must be a whole number from 1.');
  }
  if (ingredient !== undefined && step !== undefined) {
    errors.push('ingredient and step cannot both be set.');
  }
  if (errors.length > 0 || typeof text !== 'string') {
    return { ok: false, errors };
  }
  if (typeof ingredient === 'string') {
    return {
      ok: true,
      note: { scope: 'ingredient', key: ingredient.trim(), text: text.trim() },
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
