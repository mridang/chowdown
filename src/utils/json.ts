/**
 * @packageDocumentation
 *
 * Throw-free JSON parsing. Upstream responses are untrusted, so callers
 * branch on a discriminated result instead of wrapping every parse in a
 * try/catch (which forces a mutable `let`).
 */

/** Outcome of {@link safeJsonParse}. @public */
export type JsonParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

/**
 * Parse `text` as JSON without throwing.
 * @returns `{ ok: true, value }` on success, `{ ok: false, error }` with
 * the parser's message otherwise.
 * @public
 */
export function safeJsonParse(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
