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

/**
 * The most units (links plus pasted recipes) one import may hold. Every unit
 * costs an outbound fetch and up to two model calls, so the number a single
 * request can start is fixed here rather than left to the size of the text.
 */
export const MAX_IMPORT_UNITS = 10;

/** A single thing to import: either a link to fetch or a pasted text block. */
export type ImportUnit =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'text'; readonly text: string };

/** What a link looks like in pasted text: from `http(s)://` up to a space or a quote/bracket. */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`)]+/gi;

/** Characters that commonly trail a URL in prose and aren't part of it. */
const TRAILING: ReadonlySet<string> = new Set([...'.,;:!?)]}>\'"']);

/**
 * `raw` without the punctuation prose attaches to the end of a link. Looks for
 * the last character that belongs to the link instead of matching a pattern
 * anchored at the end, which would re-scan a long run of dots from every
 * position in it (quadratic in the length of the run).
 */
function trimTrailing(raw: string): string {
  // Code units are enough: every character that can trail a link is ASCII.
  const keep = raw.split('').findLastIndex((char) => !TRAILING.has(char));
  return raw.slice(0, keep + 1);
}

/**
 * Extract http(s) URLs from a blob, in order, de-duplicated. Trailing
 * punctuation that prose tends to attach ("see example.com/x.") is trimmed.
 */
export function extractUrls(input: string): readonly string[] {
  const trimmed = Array.from(input.matchAll(URL_IN_TEXT), (match) =>
    trimTrailing(match[0]),
  ).filter(Boolean);
  // A Set keeps the first occurrence of each link, in order.
  return [...new Set(trimmed)];
}

/**
 * Remove the links from the text so only prose blocks remain. One pass over
 * the text, whatever the number of links: replacing each link in turn would
 * re-scan the whole text per link.
 */
function stripUrls(input: string, urls: ReadonlySet<string>): string {
  return input.replace(URL_IN_TEXT, (match) => {
    const url = trimTrailing(match);
    return urls.has(url) ? ` ${match.slice(url.length)}` : match;
  });
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
  const prose = stripUrls(input, new Set(urls));
  return [
    ...urls.map((url): ImportUnit => ({ kind: 'url', url })),
    ...splitTextBlocks(prose).map((text): ImportUnit => ({
      kind: 'text',
      text,
    })),
  ];
}
