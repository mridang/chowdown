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
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string };

/** Characters that commonly trail a URL in prose and aren't part of it. */
const TRAILING = /[.,;:!?)\]}>'"]+$/;

/**
 * Extract http(s) URLs from a blob, in order, de-duplicated. Trailing
 * punctuation that prose tends to attach ("see example.com/x.") is trimmed.
 */
export function extractUrls(input: string): string[] {
  const matches = input.match(/https?:\/\/[^\s<>"'`)]+/gi) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(TRAILING, '');
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

/** Remove the given URLs from the text so only prose blocks remain. */
function stripUrls(input: string, urls: string[]): string {
  let out = input;
  for (const url of urls) {
    out = out.split(url).join(' ');
  }
  return out;
}

/**
 * Split pasted prose into recipe blocks. Blocks are separated by a run of two
 * or more newlines or by a markdown horizontal rule (`---`). Blocks shorter
 * than {@link MIN_BLOCK} characters are dropped as noise (stray lines left
 * behind after URLs were stripped).
 */
const MIN_BLOCK = 20;

export function splitTextBlocks(input: string): string[] {
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
export function planImport(input: string): ImportUnit[] {
  const urls = extractUrls(input);
  const units: ImportUnit[] = urls.map((url) => ({ kind: 'url', url }));
  const prose = stripUrls(input, urls);
  for (const block of splitTextBlocks(prose)) {
    units.push({ kind: 'text', text: block });
  }
  return units;
}
