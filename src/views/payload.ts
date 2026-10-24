/**
 * @packageDocumentation
 *
 * Reading what a tool call hands to a View. A host delivers the whole
 * `CallToolResult`; the View wants either the typed `structuredContent` it
 * knows how to draw, or, when the call failed or carried no data, the message
 * text so it can say what happened instead of waiting forever. These helpers do
 * that narrowing without casts: the payload is untrusted input (the host and
 * the model both sit between the server and the View), so it is checked before
 * it is used.
 */

import type { RecipeCardData, RecipeListData } from '@/domain/mcp/ui-types';

/** The parts of a `CallToolResult` a View reads. */
export interface ToolResultLike {
  readonly content?: readonly unknown[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

/**
 * What a tool result means to a View: data it can draw, or a message to show
 * (`isError` says whether the message is a failure or just a note).
 */
export type ToolOutcome<T> =
  | { readonly kind: 'data'; readonly data: T }
  | {
      readonly kind: 'message';
      readonly text: string;
      readonly isError: boolean;
    };

/** Whether the value is a non-null object, so its keys can be read safely. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** The text of every text block in a result's `content`, joined by blank lines. */
export function textOf(content: readonly unknown[] | undefined): string {
  return (content ?? [])
    .flatMap((block) =>
      isRecord(block) &&
      block['type'] === 'text' &&
      typeof block['text'] === 'string'
        ? [block['text']]
        : [],
    )
    .join('\n\n')
    .trim();
}

/** Whether the value is an array whose every entry satisfies `check`. */
function everyEntry(
  value: unknown,
  check: (entry: unknown) => boolean,
): value is readonly unknown[] {
  return Array.isArray(value) && value.every(check);
}

/** Whether the value is a string. */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Whether the value is an array of arrays (the shape of recipe steps). */
function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Whether the value has the shape of the recipe card's `structuredContent`. */
export function isRecipeCardData(value: unknown): value is RecipeCardData {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['title']) &&
    typeof value['uncurated'] === 'boolean' &&
    everyEntry(value['metadata'], isArray) &&
    everyEntry(value['ingredients'], isRecord) &&
    everyEntry(value['cookware'], isString) &&
    everyEntry(value['steps'], isArray) &&
    everyEntry(value['logs'], isRecord)
  );
}

/** Whether the value has the shape of the recipe list's `structuredContent`. */
export function isRecipeListData(value: unknown): value is RecipeListData {
  return (
    isRecord(value) &&
    everyEntry(
      value['recipes'],
      (entry) =>
        isRecord(entry) && isString(entry['id']) && isString(entry['title']),
    )
  );
}

/** The message shown when a result has neither usable data nor any text. */
export const NO_DATA_MESSAGE =
  'The assistant did not send anything to show here.';

/**
 * Interpret a tool result for a View. A failed call (`isError`) or a result
 * without data the View recognises becomes a message built from the result's
 * text, so the person sees what the server said ("No recipe found…") rather
 * than a placeholder that never resolves.
 *
 * @param result - The `CallToolResult` (or a lookalike) the host delivered.
 * @param guard - Tells whether `structuredContent` has the shape the View draws.
 */
export function readOutcome<T>(
  result: ToolResultLike,
  guard: (value: unknown) => value is T,
): ToolOutcome<T> {
  if (result.isError !== true && guard(result.structuredContent)) {
    return { kind: 'data', data: result.structuredContent };
  }
  const text = textOf(result.content);
  return {
    kind: 'message',
    text: text === '' ? NO_DATA_MESSAGE : text,
    isError: result.isError === true,
  };
}
