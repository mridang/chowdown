import { own } from '@/utils/own';

const LD_JSON = /ld\+json/iu;
const LT_SLASH_COLON_SCRIPT_OR =
  /<\/(?:script|style|noscript|svg|template)\s*>/iu;
const SCRIPT_STYLE_NOSCRIPT = /<(script|style|noscript|svg|template)\b/iu;
const LT_COLON_SCRIPT_OR_STYLE = /<(?:script|style|noscript|svg|template)\b/iu;
/**
 * @packageDocumentation
 *
 * The readable text of a web page, in linear time. A page is untrusted input
 * that a signed-in person can ask us to read, so nothing here may backtrack: the
 * scripts and style sheets are cut out by splitting on their start tags (every
 * piece is scanned once), and tags are dropped with a pattern that cannot cross
 * another angle bracket.
 */

/** The character references that turn up in the text of web pages. */
const ENTITIES = {
  '&amp;': '&',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&#8217;': '’',
  '&#8211;': '–',
  '&rsquo;': '’',
  '&ndash;': '–',
};

/** Replace the character references in `text` that are worth reading, leaving any other as it is. */
export function decodeEntities(text: string): string {
  return text.replaceAll(
    /&(?:#x?[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/gu,
    (entity) => own(ENTITIES, entity) ?? entity,
  );
}

/**
 * The page without its scripts, style sheets and other markup that is not text
 * for a reader. An unterminated script drops everything after it.
 */
export function withoutScriptsAndStyles(html: string): string {
  const [head = '', ...rest] = html.split(LT_COLON_SCRIPT_OR_STYLE);
  return (
    head +
    rest
      .map((part) => {
        const closer = LT_SLASH_COLON_SCRIPT_OR.exec(part);
        return closer ? part.slice(closer.index + closer[0].length) : '';
      })
      .join('')
  );
}

/**
 * The page without its inline scripts, style sheets and graphics, but with its
 * `application/ld+json` blocks kept: those carry the structured recipe. Pages
 * built on WordPress ship hundreds of kilobytes of inline script and CSS before
 * the footer, where the recipe card's JSON-LD often sits, so a page cut to a
 * fixed length without this loses the recipe. Linear, like
 * {@link withoutScriptsAndStyles}; an unterminated block drops the rest.
 */
export function withoutBulkMarkup(html: string): string {
  const [head = '', ...rest] = html.split(SCRIPT_STYLE_NOSCRIPT);
  const pairs = Array.from({ length: Math.floor(rest.length / 2) }, (_, n) => ({
    name: (rest[2 * n] ?? '').toLowerCase(),
    part: rest[2 * n + 1] ?? '',
  })).map(({ name, part }) => ({
    name,
    part,
    closer: LT_SLASH_COLON_SCRIPT_OR.exec(part),
  }));
  // An unterminated block ends the scan: everything after it is dropped.
  const unterminated = pairs.findIndex(({ closer }) => !closer);
  const kept = (
    unterminated === -1 ? pairs : pairs.slice(0, unterminated)
  ).flatMap(({ name, part, closer }) => {
    const end = (closer?.index ?? 0) + (closer?.[0].length ?? 0);
    const startTag = part.slice(0, part.indexOf('>') + 1);
    return name === 'script' && LD_JSON.test(startTag)
      ? [`<script${part.slice(0, end)}`, part.slice(end)]
      : [part.slice(end)];
  });
  return [head, ...kept].join('');
}

/** The most of a page that is looked at (a page is capped well below this on the way in). */
const MAX_PAGE = 400_000;

/**
 * The text a reader would see on `html`, whitespace collapsed, at most `limit`
 * characters. Tags become spaces, so words in different elements never run
 * together.
 */
export function visibleText(html: string, limit: number): string {
  return decodeEntities(
    withoutScriptsAndStyles(html.slice(0, MAX_PAGE)).replaceAll(
      /<[^<>]*>/gu,
      ' ',
    ),
  )
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, limit);
}
