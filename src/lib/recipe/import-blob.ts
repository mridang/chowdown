/**
 * @packageDocumentation
 *
 * Pure helpers for the bulk "Add recipes" box, where the user pastes a mix of
 * links, markdown and free text. We split that blob into import *units* the
 * server can process one at a time:
 *
 *   - every URL becomes a unit the server fetches and converts;
 *   - the remaining prose is split into blocks (on blank-line or `---` gaps),
 *     each treated as one pasted recipe.
 *
 * Kept free of I/O and the AI binding so the splitting logic is unit-testable.
 */

/** A single thing to import: either a link to fetch or a pasted text block. */
export type ImportUnit =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'text'; readonly text: string };

/** Characters that commonly trail a URL in prose and aren't part of it. */
const TRAILING = /[.,;:!?)\]}>'"]+$/;

/**
 * Extract http(s) URLs from a blob, in order, de-duplicated. Trailing
 * punctuation that prose tends to attach ("see example.com/x.") is trimmed.
 */
export function extractUrls(input: string): readonly string[] {
  const matches = input.match(/https?:\/\/[^\s<>"'`)]+/gi) ?? [];
  const trimmed = matches
    .map((raw) => raw.replace(TRAILING, ''))
    .filter(Boolean);
  // A Set keeps the first occurrence of each link, in order.
  return [...new Set(trimmed)];
}

/** Remove the given URLs from the text so only prose blocks remain. */
function stripUrls(input: string, urls: readonly string[]): string {
  return urls.reduce((text, url) => text.split(url).join(' '), input);
}

/** Prose blocks shorter than this are noise (stray lines left after URLs went). */
const MIN_BLOCK = 20;

/**
 * Split pasted prose into recipe blocks. Blocks are separated by a run of two
 * or more newlines or by a markdown horizontal rule (`---`). Blocks shorter
 * than {@link MIN_BLOCK} characters are dropped as noise (stray lines left
 * behind after URLs were stripped).
 */
export function splitTextBlocks(input: string): readonly string[] {
  return input
    .split(/\n\s*\n\s*\n+|\n\s*-{3,}\s*\n|\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length >= MIN_BLOCK);
}

/**
 * Turn a pasted blob into an ordered list of import units: one per URL, then
 * one per prose block in the leftover text. URLs come first because they're
 * the common case (a dump of links) and the most reliable to convert.
 */
export function planImport(input: string): readonly ImportUnit[] {
  const urls = extractUrls(input);
  const prose = stripUrls(input, urls);
  return [
    ...urls.map((url): ImportUnit => ({ kind: 'url', url })),
    ...splitTextBlocks(prose).map(
      (text): ImportUnit => ({ kind: 'text', text }),
    ),
  ];
}
