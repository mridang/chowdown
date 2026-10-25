/**
 * @packageDocumentation
 *
 * The recipe-specific side of entity tags. The generic HTTP machinery lives in
 * `@/lib/core/api` (how an `If-Match`/`If-None-Match` header is matched against
 * a content tag); this module knows the one thing that is particular to
 * recipes: a recipe can be sent in more than one representation (JSON, Cooklang
 * text, schema.org JSON-LD), and each needs a distinct tag so a cache never
 * mistakes one for another.
 *
 * An `If-Match` precondition, though, is about the recipe's *content*, not the
 * representation the client happens to hold, so a conditional write must match
 * whichever representation tag the client sends against the base content tag.
 * {@link ifMatchSatisfiedForRecipe} normalises the representation tags in the
 * header back to their base before delegating to the generic matcher.
 */

import { ifMatchSatisfied } from '@/lib/core/api';

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

/** Strip any representation suffix off every tag in a header, leaving base tags. */
function toBaseTags(header: string): string {
  return header.replace(/-(cooklang|ld)"/g, '"');
}

/**
 * Whether an `If-Match` header allows a write against the recipe's base content
 * tag. An `If-Match` is about content, so a tag for any representation of this
 * recipe (`"abc-cooklang"`, `"abc-ld"`) matches the base tag (`"abc"`): the
 * suffixes are stripped before the generic matcher is applied. Absent means yes.
 */
export function ifMatchSatisfiedForRecipe(
  header: string | null,
  base: string,
): boolean {
  return ifMatchSatisfied(header === null ? null : toBaseTags(header), base);
}
