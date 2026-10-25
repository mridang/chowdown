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
const ENTITIES: Readonly<Record<string, string>> = {
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
  return text.replace(
    /&(?:#x?[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g,
    (entity) => ENTITIES[entity] ?? entity,
  );
}

/**
 * The page without its scripts, style sheets and other markup that is not text
 * for a reader. An unterminated script drops everything after it.
 */
export function withoutScriptsAndStyles(html: string): string {
  const [head = '', ...rest] = html.split(
    /<(?:script|style|noscript|svg|template)\b/i,
  );
  return (
    head +
    rest
      .map((part) => {
        const closer = /<\/(?:script|style|noscript|svg|template)\s*>/i.exec(
          part,
        );
        return closer ? part.slice(closer.index + closer[0].length) : '';
      })
      .join('')
  );
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
    withoutScriptsAndStyles(html.slice(0, MAX_PAGE)).replace(/<[^<>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}
