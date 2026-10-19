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
export function buildStubSource(
  input: Readonly<{
    name: string;
    prompt: string;
    draft?: string;
    when?: Date;
  }>,
): string {
  const title = sanitiseName(input.name) || 'Untitled';
  const lines = [
    `>> title: ${title}`,
    `>> status: uncurated`,
    `>> created: ${isoDate(input.when)}`,
    '',
    '-- Captured idea — original request preserved verbatim:',
    asComment(input.prompt),
    '',
    input.draft?.trim()
      ? input.draft.trim()
      : '-- No method yet. Curate this recipe to fill it in.',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Insert or update `>> key: value` metadata lines, non-destructively. An
 * existing line for a key (case-insensitive) is rewritten in place; new keys
 * are inserted just after the last metadata line at the top of the file, so the
 * metadata block stays together and the method below is untouched. Like the
 * rest of this module, it's text surgery — it never round-trips through the
 * parser, so comments, ordering and the cooking log all survive.
 *
 * @param source - The `.cook` source.
 * @param pairs - `[key, value]` metadata to set (one line each).
 */
export function upsertMetadata(
  source: string,
  pairs: readonly (readonly [string, string])[],
): string {
  const lines = source.split(/\r?\n/);
  const byLowerKey = new Map(
    pairs.map(([k, v]) => [k.trim().toLowerCase(), { k: k.trim(), v }]),
  );

  // For each line, the lower-cased key it sets if it is a metadata line for
  // one of the keys we were given.
  const keyOfLine = lines.map((line) => {
    const key = /^>>\s*([^:]+):\s*(.*)$/.exec(line)?.[1]?.trim().toLowerCase();
    return key !== undefined && byLowerKey.has(key) ? key : undefined;
  });
  // Only the first line for a key is rewritten; later repeats are left as they
  // were. Reversing means the first index is the one the Map keeps.
  const firstLineOfKey = new Map(
    keyOfLine
      .flatMap((key, i) => (key === undefined ? [] : [[key, i] as const]))
      .toReversed(),
  );

  // Rewrite existing metadata lines in place.
  const rewritten = lines.map((line, i) => {
    const key = keyOfLine[i];
    const entry = key === undefined ? undefined : byLowerKey.get(key);
    return entry && key !== undefined && firstLineOfKey.get(key) === i
      ? `>> ${entry.k}: ${entry.v}`
      : line;
  });

  // Insert the keys that weren't already present.
  const toInsert = pairs
    .filter(([k]) => !firstLineOfKey.has(k.trim().toLowerCase()))
    .map(([k, v]) => `>> ${k.trim()}: ${v}`);
  const out = (
    toInsert.length > 0
      ? rewritten.toSpliced(lastMetadataLine(rewritten) + 1, 0, ...toInsert)
      : rewritten
  ).join('\n');
  return out.endsWith('\n') ? out : `${out}\n`;
}

/**
 * The index of the last `>>` metadata line in the block at the top of the file
 * (blank lines allowed between them), or -1 if the file doesn't start with
 * one. The block ends at the first line that is neither metadata nor blank.
 */
function lastMetadataLine(lines: readonly string[]): number {
  const blockEnd = lines.findIndex(
    (line) => !/^>>/.test(line) && line.trim() !== '',
  );
  const block = blockEnd === -1 ? lines : lines.slice(0, blockEnd);
  return block.findLastIndex((line) => /^>>/.test(line));
}

/**
 * Remove every `>> key: …` metadata line for `key` (case-insensitive), leaving
 * the rest of the file untouched. A no-op if the key isn't present.
 */
export function removeMetadata(source: string, key: string): string {
  const target = key.trim().toLowerCase();
  return source
    .split(/\r?\n/)
    .filter((line) => {
      const key = /^>>\s*([^:]+):/.exec(line)?.[1];
      return key === undefined || key.trim().toLowerCase() !== target;
    })
    .join('\n');
}

/** Metadata values that mean "no value" — a model's way of saying it doesn't know. */
const EMPTY_VALUE =
  /^(unknown|n\/a|na|none|null|undefined|-+|tbd|not specified)?$/i;

/**
 * Drop `>> key: value` metadata lines whose value is blank or a placeholder
 * like "unknown". The conversion model sometimes emits `>> servings: ` or
 * `>> time: unknown` for things the page never said; those would show up as
 * junk on the recipe card, so remove them. Only the metadata lines are touched.
 */
export function removeEmptyMetadata(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => {
      const value = /^>>\s*[^:]+:\s*(.*)$/.exec(line)?.[1];
      return value === undefined || !EMPTY_VALUE.test(value.trim());
    })
    .join('\n');
}

/**
 * The `>> source:` URL recorded in a recipe's source, if any. Imports write the
 * page they came from here, which is how we recognise a link we already have.
 */
export function sourceUrlOf(source: string): string | undefined {
  return /^>>\s*source:\s*(\S+)/im.exec(source)?.[1];
}

/**
 * The site a web address belongs to: its lower-case host without `www.`.
 * Returns undefined for anything that isn't an http(s) address, so a stray
 * `>> source: my gran` never becomes a "site".
 */
export function domainOf(url: string): string | undefined {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return undefined;
    }
    return u.hostname.toLowerCase().replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

/** The site a recipe's `>> source:` points at, if it has one. */
export function sourceDomainOf(source: string): string | undefined {
  const url = sourceUrlOf(source);
  return url ? domainOf(url) : undefined;
}

/** Query parameters that only track where a click came from, never which page. */
const TRACKING_PARAM =
  /^(utm\w*|fbclid|gclid|mc_\w+|ref|ref_src|igshid|si|feature|spm|cid)$/i;

/**
 * Normalise a URL for "is this the same page?" comparison: lower-case host
 * without `www.`, no fragment, no trailing slash, and no *tracking* parameters.
 * Parameters that identify the page are kept — `watch?v=abc` and `watch?v=xyz`
 * are different videos — and sorted so their order doesn't matter. Returns the
 * trimmed input unchanged if it isn't a parseable URL.
 */
export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const kept = [...u.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAM.test(key))
      .toSorted(([a], [b]) => a.localeCompare(b));
    const query = kept.length
      ? `?${kept.map(([k, v]) => `${k}=${v}`).join('&')}`
      : '';
    return `${host}${u.pathname.replace(/\/+$/, '')}${query}`;
  } catch {
    return url.trim();
  }
}

/**
 * A personal annotation attached to a recipe. Notes are additive and never
 * touch the original method: they're stored as Cooklang comment lines so the
 * recipe the user imported stays verbatim, while their own amendments ("use 3
 * avocados", "marinate overnight") accrue alongside it.
 *
 *   - `scope: 'ingredient'` — shown next to the matching ingredient (`key` is
 *     the ingredient name).
 *   - `scope: 'step'` — shown next to the step (`key` is the 1-based number).
 *   - `scope: 'general'` — a free note shown in a Notes section.
 */
export interface Note {
  readonly scope: 'general' | 'ingredient' | 'step';
  /** Ingredient name or step number; empty for a general note. */
  readonly key: string;
  readonly text: string;
}

/** Matches a note comment: `-- [note]`, `-- [note ingredient:x]`, `-- [note step:2]`. */
const NOTE_LINE = /^-- \[note(?:\s+(ingredient|step):([^\]]+))?\]\s*(.*)$/;

/**
 * Append a personal note to a recipe's source, non-destructively. The text is
 * flattened to one line (so it stays a valid Cooklang comment) and a trailing
 * newline is ensured. The original method is never modified.
 */
export function appendNote(source: string, note: Readonly<Note>): string {
  const base = source.endsWith('\n') ? source : `${source}\n`;
  return `${base}${noteLine(note)}\n`;
}

/** Extract all personal notes from a recipe's source, in file order. */
export function extractNotes(source: string): readonly Note[] {
  return source.split(/\r?\n/).flatMap((line): readonly Note[] => {
    const m = NOTE_LINE.exec(line);
    if (!m) {
      return [];
    }
    const scope = m[1] === 'ingredient' || m[1] === 'step' ? m[1] : 'general';
    return [{ scope, key: (m[2] ?? '').trim(), text: (m[3] ?? '').trim() }];
  });
}

/**
 * A note's ingredient key as it can be written: one line, with no `]`, since it
 * sits inside `[...]`. May come out empty (a key of only brackets), which can't
 * be written at all.
 */
export function flatNoteKey(key: string): string {
  return key.replace(/[\]\s]+/g, ' ').trim();
}

/** The text of one note as a comment line (the format {@link appendNote} writes). */
function noteLine(note: Readonly<Note>): string {
  const flat = note.text.replace(/\s*\r?\n\s*/g, ' ').trim();
  // A line break or a `]` in the key would end the marker early or start a
  // line of its own.
  const key = flatNoteKey(note.key);
  const target = note.scope === 'general' ? '' : ` ${note.scope}:${key}`;
  return `-- [note${target}] ${flat}`;
}

/**
 * Replace the `index`-th note (0-based, in file order) with a new one. Returns
 * undefined if there is no such note. Everything else in the file is untouched.
 */
export function replaceNote(
  source: string,
  index: number,
  note: Readonly<Note>,
): string | undefined {
  const lines = source.split(/\r?\n/);
  const at = noteLineIndex(lines, index);
  return at === undefined
    ? undefined
    : lines.with(at, noteLine(note)).join('\n');
}

/**
 * Remove the `index`-th note (0-based, in file order). Returns undefined if
 * there is no such note. Everything else in the file is untouched.
 */
export function removeNote(source: string, index: number): string | undefined {
  const lines = source.split(/\r?\n/);
  const at = noteLineIndex(lines, index);
  return at === undefined ? undefined : lines.toSpliced(at, 1).join('\n');
}

/**
 * Which line holds the `index`-th note (0-based, in file order), or undefined
 * when there are fewer notes than that or `index` is negative.
 */
function noteLineIndex(
  lines: readonly string[],
  index: number,
): number | undefined {
  const noteLines = lines.flatMap((line, i) =>
    NOTE_LINE.test(line) ? [i] : [],
  );
  return index >= 0 ? noteLines[index] : undefined;
}

/** A single dated cooking-log entry parsed back out of a `.cook` file. */
export interface CookingLogEntry {
  readonly date: string;
  readonly note: string;
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
export function extractCookingLogs(source: string): readonly CookingLogEntry[] {
  return source.split(/\r?\n/).flatMap((line): readonly CookingLogEntry[] => {
    const match = LOG_LINE.exec(line);
    return match ? [{ date: match[1] ?? '', note: match[2] ?? '' }] : [];
  });
}
