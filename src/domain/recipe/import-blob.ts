const NON_WHITESPACE = /\S/u;
const NOT_DASH = /[^-]/u;
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
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`)]+/giu;

/** Characters that commonly trail a URL in prose and aren't part of it. */
const TRAILING: ReadonlySet<string> = new Set('.,;:!?)]}>\'"');

/**
 * `raw` without the punctuation prose attaches to the end of a link. Looks for
 * the last character that belongs to the link instead of matching a pattern
 * anchored at the end, which would re-scan a long run of dots from every
 * position in it (quadratic in the length of the run).
 */
function trimTrailing(raw: string): string {
  // Code points, so a surrogate pair is never split; every trailing character is ASCII.
  const chars = Array.from(raw);
  return chars
    .slice(0, chars.findLastIndex((char) => !TRAILING.has(char)) + 1)
    .join('');
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
  return input.replaceAll(URL_IN_TEXT, (match) => {
    const url = trimTrailing(match);
    return urls.has(url) ? ` ${match.slice(url.length)}` : match;
  });
}

/** Prose blocks shorter than this are noise (stray lines left after URLs went). */
const MIN_BLOCK = 20;

/** The index after the whitespace run that starts at `from`. */
function whitespaceEnd(text: string, from: number): number {
  // A slice shares the text's memory, so this costs the length of the run only.
  const offset = text.slice(from).search(NON_WHITESPACE);
  return offset === -1 ? text.length : from + offset;
}

/** How many line breaks a span holds, and the index after the last. */
interface LineBreaks {
  readonly count: number;
  readonly after: number;
}

/** How many line breaks `text` holds from `from` up to (not including) `to`, and the index after the last. */
function lineBreaks(text: string, from: number, to: number): LineBreaks {
  const span = text.slice(from, to);
  const last = span.lastIndexOf('\n');
  return {
    count: span.split('\n').length - 1,
    after: last === -1 ? to : from + last + 1,
  };
}

/**
 * Where a separator that starts at the line break `at` ends, or -1 when none
 * does: whitespace holding three or more line breaks, a line of three or more
 * dashes between line breaks, or whitespace holding two line breaks. They are
 * tried in that order.
 */
function separatorEnd(text: string, at: number): number {
  const runEnd = whitespaceEnd(text, at);
  const run = lineBreaks(text, at, runEnd);
  if (run.count >= 3) {
    return run.after;
  }
  const dashes = text.slice(runEnd).search(NOT_DASH);
  const dashEnd = dashes === -1 ? text.length : runEnd + dashes;
  if (dashEnd - runEnd >= 3) {
    const trailing = lineBreaks(text, dashEnd, whitespaceEnd(text, dashEnd));
    if (trailing.count > 0) {
      return trailing.after;
    }
  }
  return run.count === 2 ? run.after : -1;
}

/** `input` cut at every separator (see {@link separatorEnd}). */
function splitAtSeparators(input: string): readonly string[] {
  const parts: string[] = [];
  // eslint-disable-next-line functional/no-let -- the scan is a cursor over untrusted text; recursion would overflow the stack and copying would be quadratic
  let start = 0;
  // eslint-disable-next-line functional/no-let -- the scan is a cursor over untrusted text; recursion would overflow the stack and copying would be quadratic
  let at = input.indexOf('\n');
  // eslint-disable-next-line functional/no-loop-statements -- the scan is a cursor over untrusted text; recursion would overflow the stack and copying would be quadratic
  while (at !== -1) {
    const end = separatorEnd(input, at);
    if (end === -1) {
      at = input.indexOf('\n', at + 1);
    } else {
      // eslint-disable-next-line functional/immutable-data -- collecting the parts of the scan
      parts.push(input.slice(start, at));
      start = end;
      at = input.indexOf('\n', end);
    }
  }
  // eslint-disable-next-line functional/immutable-data -- collecting the parts of the scan
  parts.push(input.slice(start));
  return parts;
}

/**
 * Split pasted prose into recipe blocks. Blocks are separated by a run of two
 * or more newlines or by a markdown horizontal rule (`---`). Blocks shorter
 * than {@link MIN_BLOCK} characters are dropped as noise (stray lines left
 * behind after URLs were stripped).
 */
export function splitTextBlocks(input: string): readonly string[] {
  return splitAtSeparators(input)
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
