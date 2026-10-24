/**
 * @packageDocumentation
 *
 * Entity tags for optimistic concurrency and cheap re-reads. A recipe's tag is
 * a hash of its Cooklang source, so it changes exactly when the content does.
 * `If-Match` on a write refuses (412) if someone changed the recipe meanwhile;
 * `If-None-Match` on a read answers 304 when nothing changed.
 */

/** A strong entity tag for some text: the quoted first 16 hex digits of its SHA-256. */
export async function entityTag(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  const hex = [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `"${hex}"`;
}

/** The ways one recipe can be sent: JSON, Cooklang text, or schema.org JSON-LD. */
export type RecipeRepresentation = 'json' | 'cooklang' | 'ld';

/**
 * Different representations of one recipe (JSON, Cooklang text, JSON-LD) are
 * different entities, so each needs its own tag or a cache could mistake one for
 * another. JSON keeps the base tag; the others add a suffix.
 */
export function representationTag(
  base: string,
  kind: RecipeRepresentation,
): string {
  return kind === 'json' ? base : `${base.slice(0, -1)}-${kind}"`;
}

/** The base (content) tag for a representation tag. */
function baseTag(tag: string): string {
  return tag.replace(/-(cooklang|ld)"$/, '"');
}

/** The tags in an `If-Match` / `If-None-Match` header (weak markers ignored). */
function tagsIn(header: string): readonly string[] {
  return header
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .filter(Boolean);
}

/** Whether an `If-Match` header allows a write against `current`. Absent means yes. */
export function ifMatchSatisfied(
  header: string | null,
  current: string,
): boolean {
  if (header === null) {
    return true;
  }
  const tags = tagsIn(header).map(baseTag);
  return tags.includes('*') || tags.includes(current);
}

/** Whether an `If-None-Match` header says the client already has `current`. */
export function ifNoneMatchHit(
  header: string | null,
  current: string,
): boolean {
  if (header === null) {
    return false;
  }
  const tags = tagsIn(header);
  return tags.includes('*') || tags.includes(current);
}
