/**
 * @packageDocumentation
 *
 * Recipe imports on the wire: checking the pasted text a client posts, the
 * one-line summary a list shows for each import, and the newest-first order
 * (with the cursor positions that go with it).
 */

import type { RecipeImport } from '@/lib/db/recipe-imports';
import type { CursorPosition } from '@/lib/api/pagination';

/** Largest pasted blob accepted, in characters. */
export const MAX_INPUT = 100_000;

/**
 * Largest request body an import accepts, in bytes. A blob of {@link MAX_INPUT}
 * characters can take three bytes a character in many scripts, plus the JSON
 * around it.
 */
export const MAX_IMPORT_BODY_BYTES = 1024 * 1024;

/** The checked pasted text of an import, or what was wrong with it. */
export type ImportInput =
  | { readonly ok: true; readonly input: string }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Check the `input` of `POST /api/recipes/imports`: required, not blank, within the limit. */
export function parseImportInput(body: unknown): ImportInput {
  const input =
    typeof body === 'object' && body !== null
      ? Reflect.get(body, 'input')
      : undefined;
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, errors: ['input: required.'] };
  }
  return input.length > MAX_INPUT
    ? { ok: false, errors: ['input: too large.'] }
    : { ok: true, input: input.trim() };
}

/** What a list shows for each import. */
export interface ImportSummary {
  readonly id: string;
  readonly status: RecipeImport['status'];
  readonly created_at: string;
  readonly item_count: number;
}

/** The summary of an import: no drafts, just how many there are. */
export function importSummary(imported: Readonly<RecipeImport>): ImportSummary {
  return {
    id: imported.id,
    status: imported.status,
    created_at: imported.created_at,
    item_count: imported.items.length,
  };
}

/** An import's place in the list, for cursors. */
export function importPosition(
  imported: Readonly<RecipeImport>,
): CursorPosition {
  return { key: imported.created_at, id: imported.id };
}

/** Order two positions newest first, ties by id: "after" then means older. */
export function compareImportPositions(
  a: CursorPosition,
  b: CursorPosition,
): number {
  return a.key === b.key
    ? a.id.localeCompare(b.id)
    : b.key.localeCompare(a.key);
}
