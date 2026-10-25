/**
 * @packageDocumentation
 *
 * What the installed app does when something is shared to it. The manifest's
 * `share_target` makes chowdown appear in the system share sheet (Android and
 * desktop Chrome); choosing it opens `/recipes/add?title=…&text=…&url=…`. The
 * three values come from whatever app did the sharing, which cannot be trusted
 * to fill them in a consistent way: a browser puts the address in `url`, many
 * Android apps put the whole message, address included, in `text`, and a notes
 * app may share a recipe's words with no address at all.
 *
 * The functions here turn that into the one string the importer's text box
 * starts with, and into the address to come back to after signing in. They are
 * pure so each case can be tested without a browser. Nothing here starts an
 * import: that costs AI budget, so it stays a deliberate press of a button.
 */

import { extractUrls } from '@/domain/recipe/import-blob';

/** The path of the page that adds recipes, which is also the share target. */
export const ADD_RECIPES_PATH = '/recipes/add';

/**
 * The most characters of shared text the page takes. A shared link is a few
 * hundred at most and a shared recipe a few thousand; the cap exists so that a
 * share of something huge cannot fill the text box (or the address bar, where
 * the browser and Cloudflare each have a limit of their own).
 */
export const MAX_SHARED_CHARACTERS = 10_000;

/**
 * The longest shared input that is kept through signing in. The address to
 * return to travels in a cookie (4 KB in all, and the address is escaped twice
 * on the way), so a long share is not carried; the person shares it again.
 */
export const MAX_PRESERVED_CHARACTERS = 1_000;

/**
 * The line shown with the importer's box when it was filled in by a share, so
 * the person knows where the text came from and what happens next.
 */
export const SHARED_HINT =
  'Shared from another app. Check it, then press Prepare recipes.';

/** The query-string values Next hands a page: one string, several, or none. */
export type ShareParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/**
 * The code points that are not text: control characters other than a line break
 * or a tab, and the invisible characters that reorder or hide what is around
 * them (the bidirectional overrides and isolates, the zero-width characters),
 * which could make a link in the text box read as a different one than it is.
 * Each range is first and last, both included.
 */
const NOT_TEXT: readonly (readonly [number, number])[] = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2060],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
];

/** Whether a character is text, as opposed to one of {@link NOT_TEXT}. */
function isText(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return !NOT_TEXT.some(([low, high]) => code >= low && code <= high);
}

/** The first value of a query parameter, whether it came once or repeated. */
function first(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** The code points that end a line other than `\n`: carriage return, line and paragraph separators. */
const OTHER_LINE_BREAKS: ReadonlySet<number> = new Set([0x0d, 0x2028, 0x2029]);

/**
 * Plain text from a shared value: every kind of line ending made `\n`,
 * everything that is not text removed, the ends trimmed.
 */
function cleaned(value: string): string {
  return [...value.replaceAll('\r\n', '\n')]
    .flatMap((char) =>
      OTHER_LINE_BREAKS.has(char.codePointAt(0) ?? 0)
        ? ['\n']
        : isText(char)
          ? [char]
          : [],
    )
    .join('')
    .trim();
}

/** `text` cut to at most `limit` characters, never in the middle of an emoji. */
function capped(text: string, limit: number): string {
  return [...text].slice(0, limit).join('').trim();
}

/**
 * Whether a string is an address worth importing: http or https, with a host,
 * and without a name or password in it (an address that carries credentials is
 * not one to put in front of a fetcher, or to keep in the browser's history).
 */
function isImportableUrl(candidate: string): boolean {
  if (!URL.canParse(candidate)) {
    return false;
  }
  const url = new URL(candidate);
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    url.hostname !== '' &&
    url.username === '' &&
    url.password === ''
  );
}

/** The first importable address in a piece of text, if it has one. */
function firstUrlIn(text: string): string | undefined {
  return extractUrls(text).find(
    (url) => url.length <= MAX_SHARED_CHARACTERS && isImportableUrl(url),
  );
}

/**
 * What the importer's text box should start with for a share.
 *
 *  1. The shared `url`, when it is an address.
 *  2. Otherwise the first address in `text` (a message such as "Look at this
 *     https://example.com/pancakes" shares that way), without the words around
 *     it: the importer would take the words for a recipe of their own.
 *  3. Otherwise the shared words themselves, with the `title` above them, so a
 *     recipe shared from a notes app can be imported as text.
 *
 * Everything is reduced to plain text and capped at {@link MAX_SHARED_CHARACTERS}.
 * Returns an empty string when there is nothing to import, which is also what
 * opening the page without sharing gives.
 */
export function sharedImportInput(params: ShareParams): string {
  const title = cleaned(first(params['title']));
  const text = cleaned(first(params['text']));
  const url = firstUrlIn(cleaned(first(params['url']))) ?? firstUrlIn(text);
  if (url !== undefined) {
    return url;
  }
  const words =
    title === '' || text.includes(title) ? text : `${title}\n\n${text}`;
  // A title with nothing under it is the name of a page, not a recipe.
  return text === '' ? '' : capped(words, MAX_SHARED_CHARACTERS);
}

/**
 * The path of the add-recipes page carrying a share, to return to after
 * signing in (or connecting Drive) so that nothing the person shared is lost on
 * the way. A link goes back as `url`, anything else as `text`, and
 * {@link sharedImportInput} reads either back to the same input. An empty
 * input, or one longer than {@link MAX_PRESERVED_CHARACTERS}, gives the plain
 * path: a cut-off recipe would be worse than none.
 */
export function addRecipesPath(input: string): string {
  if (input === '' || input.length > MAX_PRESERVED_CHARACTERS) {
    return ADD_RECIPES_PATH;
  }
  const name = isImportableUrl(input) ? 'url' : 'text';
  return `${ADD_RECIPES_PATH}?${new URLSearchParams([[name, input]]).toString()}`;
}
