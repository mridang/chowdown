/**
 * @packageDocumentation
 *
 * Raw-text helpers for the `.cook` files chowdown writes to Drive. These are
 * deliberately string-only and never round-trip through the Cooklang parser:
 * parsing and re-serialising would silently drop comments, metadata ordering
 * and anything the parser doesn't model, which would destroy exactly the data
 * the write features add (the captured prompt, the cooking log). So every
 * mutation here is additive text surgery on the source the user owns.
 *
 * Two product concepts live here:
 *
 *   - **Uncurated stubs** — when the MCP `capture_idea` tool records a wish
 *     ("I should figure out how to make paneer ki sabji"), we create a stub
 *     `.cook` whose *filename* carries an `[uncurated]` marker (flat structure,
 *     no special folder) and whose body preserves the original prompt verbatim.
 *     The app UI reads the marker to group these onto an "Uncurated" shelf.
 *
 *   - **Cooking logs** — when the MCP `log_cooking` tool records a real cook
 *     ("made bolognese today, used 500 g pork and 1 L milk, turned out great"),
 *     we append a dated line the Cooklang parser treats as a comment, so the
 *     recipe accrues the user's real-world notes over time without changing the
 *     method itself.
 */

/**
 * Filename marker that flags an uncurated stub. Kept as a bracketed suffix
 * before the extension so it reads naturally in Drive ("paneer ki sabji
 * [uncurated].cook") and is trivial to detect and strip.
 */
export const UNCURATED_MARKER = '[uncurated]';

/** ISO calendar date (YYYY-MM-DD) in UTC for the given instant (default: now). */
function isoDate(when: Date = new Date()): string {
  return when.toISOString().slice(0, 10);
}

/**
 * Normalise a free-text dish name into something safe for a Drive filename:
 * collapse whitespace and strip characters that are awkward in file names.
 * Drive itself allows most characters, but `/` is path-significant and leading
 * dots hide files, so we remove those and tidy the rest.
 */
export function sanitiseName(name: string): string {
  return name
    .replace(/[/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();
}

/** Build the filename for an uncurated stub, e.g. `paneer ki sabji [uncurated].cook`. */
export function uncuratedFilename(name: string): string {
  const clean = sanitiseName(name) || 'untitled';
  return `${clean} ${UNCURATED_MARKER}.cook`;
}

/** True if a filename is an uncurated stub (case-insensitive, extension optional). */
export function isUncurated(filename: string): boolean {
  return filename.toLowerCase().includes(UNCURATED_MARKER);
}

/**
 * Human-facing recipe name from a filename: drop the `.cook` extension and the
 * uncurated marker, then tidy whitespace. `pancakes.cook` -> `pancakes`;
 * `paneer ki sabji [uncurated].cook` -> `paneer ki sabji`.
 */
export function recipeDisplayName(filename: string): string {
  return filename
    .replace(/\.cook$/i, '')
    .replace(new RegExp(`\\s*\\${UNCURATED_MARKER}\\s*`, 'i'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turn an arbitrary string into Cooklang comment lines (`-- ...` per line). */
function asComment(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `-- ${line}`.trimEnd())
    .join('\n');
}

/**
 * Build the body of an uncurated stub. The original prompt is preserved
 * verbatim as a comment so nothing the user said is lost, and a `draft` (e.g.
 * a recipe the calling assistant generated) is included as the method when
 * provided; otherwise a gentle placeholder stands in until the user curates it.
 */
export function buildStubSource(input: {
  name: string;
  prompt: string;
  draft?: string;
  when?: Date;
}): string {
  const title = sanitiseName(input.name) || 'Untitled';
  const lines = [
    `>> title: ${title}`,
    `>> status: uncurated`,
    `>> created: ${isoDate(input.when)}`,
    '',
    '-- Captured idea — original request preserved verbatim:',
    asComment(input.prompt),
    '',
  ];
  lines.push(
    input.draft?.trim()
      ? input.draft.trim()
      : '-- No method yet. Curate this recipe to fill it in.',
  );
  return `${lines.join('\n')}\n`;
}

/** A single dated cooking-log entry parsed back out of a `.cook` file. */
export interface CookingLogEntry {
  date: string;
  note: string;
}

/** Matches a cooking-log comment line: `-- [cook YYYY-MM-DD] note`. */
const LOG_LINE = /^-- \[cook (\d{4}-\d{2}-\d{2})\] (.*)$/;

/**
 * Append a dated cooking-log entry to a recipe's source, non-destructively.
 * The note is flattened to a single line (newlines → spaces) so it stays a
 * valid one-line Cooklang comment, and a trailing newline is ensured so the
 * entry never fuses onto the last line of the method.
 */
export function appendCookingLog(
  source: string,
  note: string,
  when: Date = new Date(),
): string {
  const flat = note.replace(/\s*\r?\n\s*/g, ' ').trim();
  const base = source.endsWith('\n') ? source : `${source}\n`;
  return `${base}-- [cook ${isoDate(when)}] ${flat}\n`;
}

/** Extract all cooking-log entries from a recipe's source, in file order. */
export function extractCookingLogs(source: string): CookingLogEntry[] {
  const entries: CookingLogEntry[] = [];
  for (const line of source.split(/\r?\n/)) {
    const match = LOG_LINE.exec(line);
    if (match) {
      entries.push({ date: match[1]!, note: match[2]! });
    }
  }
  return entries;
}
