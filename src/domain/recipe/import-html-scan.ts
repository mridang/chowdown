/**
 * @packageDocumentation
 *
 * A small, linear-time reader for the two things recipe import wants from a
 * web page: its `<meta>` tags (for the `og:image` cover) and its
 * `application/ld+json` scripts (for the structured recipe).
 *
 * The page is hostile input: anyone can host one, and a signed-in user can ask
 * us to import it. The obvious way to pick these tags out is one regular
 * expression per question, with lazy gaps between the attributes. That is
 * exactly the shape that backtracks catastrophically: a few tens of kilobytes
 * of `<meta content="a" ` repeated take seconds of CPU, and a Worker isolate
 * serves every other request on that CPU. So nothing here is allowed to
 * backtrack. One pass finds every tag with a pattern that cannot overlap
 * itself (`[^<>]*` stops at the next angle bracket), a fold walks the tags in
 * order the way a browser would (a `<script>` swallows everything up to its
 * `</script>`, so tags inside script text are not tags), and each tag's
 * attributes are read by a second pattern whose pieces cannot overlap either.
 * Every step is linear in the size of the page.
 */

/** A tag's attributes by lowercase name; where a name repeats, the first one wins (as in HTML). */
export type Attributes = ReadonlyMap<string, string>;

/** What a page holds that import cares about, in document order. */
export interface HtmlScan {
  /** The attributes of each `<meta>` tag outside a script. */
  readonly metas: readonly Attributes[];
  /** The text of each `<script type="application/ld+json">` that was closed. */
  readonly jsonLd: readonly string[];
}

/**
 * The most tags of each kind kept. A real page has a few dozen `<meta>` tags
 * and a handful of JSON-LD blocks; the cap keeps a page made of nothing but
 * tags from making the result (and the copying that builds it) large.
 */
const MAX_KEPT = 200;

/**
 * A `<meta>` or `<script>` start tag, or a `</script>` end tag. The tag name
 * must be followed by whitespace, `/` or `>` so `<metadata>` is not a `<meta>`.
 * `[^<>]*` cannot cross another bracket, which is what keeps a run of
 * unterminated tags linear instead of quadratic.
 */
const TAG = /<(meta|script)(?=[\s/>])([^<>]*)>|<\/script\s*>/gi;

/**
 * One attribute: a name, then optionally `=` and a double-quoted, single-quoted
 * or bare value. The name and value classes exclude each other's delimiters, so
 * no two parts of the pattern can claim the same characters.
 */
const ATTRIBUTE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** The attributes in the text between a tag's name and its `>`. */
function parseAttributes(text: string): Attributes {
  const entries = Array.from(
    text.matchAll(ATTRIBUTE),
    (match): readonly [string, string] => [
      (match[1] ?? '').toLowerCase(),
      match[2] ?? match[3] ?? match[4] ?? '',
    ],
  );
  // A Map keeps the last entry for a name, so the entries go in reversed to
  // make the first one win.
  return new Map(entries.toReversed());
}

/** Whether a script's `type` attribute names JSON-LD (parameters such as `charset` are ignored). */
function isJsonLdType(attributes: Attributes): boolean {
  const [essence = ''] = (attributes.get('type') ?? '').split(';');
  return essence.trim().toLowerCase() === 'application/ld+json';
}

/** Where the walk over a page's tags has got to. */
interface Walk {
  readonly metas: readonly Attributes[];
  readonly jsonLd: readonly string[];
  /** Inside a script: where its text starts and whether it is JSON-LD; otherwise null. */
  readonly script: { readonly from: number; readonly jsonLd: boolean } | null;
}

/** The state before the first tag. */
const START: Walk = { metas: [], jsonLd: [], script: null };

/** Take one tag: the walk after it. */
function step(html: string, walk: Walk, tag: RegExpMatchArray): Walk {
  const at = tag.index ?? 0;
  const name = tag[1]?.toLowerCase();
  if (walk.script) {
    // Inside a script only its end tag means anything; everything else is text.
    if (name !== undefined) {
      return walk;
    }
    return {
      ...walk,
      script: null,
      jsonLd:
        walk.script.jsonLd && walk.jsonLd.length < MAX_KEPT
          ? [...walk.jsonLd, html.slice(walk.script.from, at)]
          : walk.jsonLd,
    };
  }
  if (name === 'script') {
    return {
      ...walk,
      script: {
        from: at + tag[0].length,
        jsonLd: isJsonLdType(parseAttributes(tag[2] ?? '')),
      },
    };
  }
  if (name === 'meta' && walk.metas.length < MAX_KEPT) {
    return { ...walk, metas: [...walk.metas, parseAttributes(tag[2] ?? '')] };
  }
  // A stray `</script>`, or a `<meta>` past the cap.
  return walk;
}

/**
 * Read a page's `<meta>` tags and JSON-LD scripts in one linear pass. A script
 * that is never closed is dropped, as it would be by the expression this
 * replaces; anything that does not look like a tag is skipped.
 */
export function scanHtml(html: string): HtmlScan {
  const { metas, jsonLd } = Array.from(html.matchAll(TAG)).reduce(
    (walk, tag) => step(html, walk, tag),
    START,
  );
  return { metas, jsonLd };
}
