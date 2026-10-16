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
  pairs: [string, string][],
): string {
  const lines = source.split(/\r?\n/);
  const applied = new Set<string>();
  const byLowerKey = new Map(
    pairs.map(([k, v]) => [k.trim().toLowerCase(), { k: k.trim(), v }]),
  );

  // Rewrite existing metadata lines in place.
  for (let i = 0; i < lines.length; i++) {
    const m = /^>>\s*([^:]+):\s*(.*)$/.exec(lines[i]!);
    if (!m) {
      continue;
    }
    const lk = m[1]!.trim().toLowerCase();
    const entry = byLowerKey.get(lk);
    if (entry && !applied.has(lk)) {
      lines[i] = `>> ${entry.k}: ${entry.v}`;
      applied.add(lk);
    }
  }

  // Insert the keys that weren't already present.
  const toInsert = pairs
    .filter(([k]) => !applied.has(k.trim().toLowerCase()))
    .map(([k, v]) => `>> ${k.trim()}: ${v}`);
  if (toInsert.length > 0) {
    let lastMeta = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^>>/.test(lines[i]!)) {
        lastMeta = i;
        continue;
      }
      if (lines[i]!.trim() === '') {
        continue;
      }
      break;
    }
    lines.splice(lastMeta + 1, 0, ...toInsert);
  }

  const out = lines.join('\n');
  return out.endsWith('\n') ? out : `${out}\n`;
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
      const m = /^>>\s*([^:]+):/.exec(line);
      return !m || m[1]!.trim().toLowerCase() !== target;
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
      const m = /^>>\s*[^:]+:\s*(.*)$/.exec(line);
      return !m || !EMPTY_VALUE.test(m[1]!.trim());
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
 * Normalise a URL for "is this the same page?" comparison: lower-case host
 * without `www.`, no query or fragment, no trailing slash. Returns the trimmed
 * input unchanged if it isn't a parseable URL.
 */
export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return `${host}${u.pathname.replace(/\/+$/, '')}`;
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
  scope: 'general' | 'ingredient' | 'step';
  /** Ingredient name or step number; empty for a general note. */
  key: string;
  text: string;
}

/** Matches a note comment: `-- [note]`, `-- [note ingredient:x]`, `-- [note step:2]`. */
const NOTE_LINE = /^-- \[note(?:\s+(ingredient|step):([^\]]+))?\]\s*(.*)$/;

/**
 * Append a personal note to a recipe's source, non-destructively. The text is
 * flattened to one line (so it stays a valid Cooklang comment) and a trailing
 * newline is ensured. The original method is never modified.
 */
export function appendNote(source: string, note: Note): string {
  const flat = note.text.replace(/\s*\r?\n\s*/g, ' ').trim();
  const target =
    note.scope === 'general' ? '' : ` ${note.scope}:${note.key.trim()}`;
  const base = source.endsWith('\n') ? source : `${source}\n`;
  return `${base}-- [note${target}] ${flat}\n`;
}

/** Extract all personal notes from a recipe's source, in file order. */
export function extractNotes(source: string): Note[] {
  const notes: Note[] = [];
  for (const line of source.split(/\r?\n/)) {
    const m = NOTE_LINE.exec(line);
    if (!m) {
      continue;
    }
    const scope = (m[1] as 'ingredient' | 'step' | undefined) ?? 'general';
    notes.push({ scope, key: (m[2] ?? '').trim(), text: m[3]!.trim() });
  }
  return notes;
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
