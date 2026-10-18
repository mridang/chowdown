/**
 * @packageDocumentation
 *
 * Applying a JSON Merge Patch (RFC 7396) to a recipe's Cooklang source. Only a
 * few fields of a recipe are meant to be edited this way; everything else the
 * API shows (ingredients, steps, the favourite flag…) is derived or has its own
 * resource, so a patch that mentions it is refused rather than half-applied.
 *
 *   title   string                  the recipe's title
 *   images  string[] | null         cover first; null removes them all
 *   tags    { facet: string[] | null }   per facet; null removes the facet
 *
 * The edit is text surgery on the metadata lines, so the method, notes and
 * cooking log are never touched.
 */

import { listAnd } from '../intl';
import { removeMetadata, upsertMetadata } from './cook-text';
import { validImageUrls, withImages } from './media';
import { FACETS, canonicalValue, facet } from './taxonomy';

/** The outcome of a patch: new source, or what was wrong with it. */
export type PatchResult =
  | { ok: true; source: string }
  | { ok: false; errors: string[] };

const EDITABLE = ['title', 'images', 'tags'];

/** Apply a merge patch to a recipe's source. */
export function applyRecipePatch(
  source: string,
  patch: Record<string, unknown>,
): PatchResult {
  const errors: string[] = [];
  let out = source;

  for (const key of Object.keys(patch)) {
    if (!EDITABLE.includes(key)) {
      errors.push(
        `${key}: not editable here (editable: ${listAnd(EDITABLE)}).`,
      );
    }
  }

  if ('title' in patch) {
    const title = patch['title'];
    if (typeof title !== 'string' || !title.trim()) {
      errors.push('title: must be a non-empty string.');
    } else {
      out = upsertMetadata(out, [['title', title.trim().replace(/\s+/g, ' ')]]);
    }
  }

  if ('images' in patch) {
    const images = patch['images'];
    if (images === null) {
      out = removeMetadata(out, 'images');
    } else if (
      !Array.isArray(images) ||
      images.some((i) => typeof i !== 'string')
    ) {
      errors.push('images: must be an array of URLs, or null to remove them.');
    } else if (images.length === 0) {
      out = removeMetadata(out, 'images');
    } else if (validImageUrls(images as string[]).length === 0) {
      errors.push('images: none of the URLs are usable http(s) image URLs.');
    } else {
      out = withImages(out, images as string[]);
    }
  }

  if ('tags' in patch) {
    const tags = patch['tags'];
    if (typeof tags !== 'object' || tags === null || Array.isArray(tags)) {
      errors.push('tags: must be an object of facet → values.');
    } else {
      for (const [key, raw] of Object.entries(tags)) {
        const f = facet(key);
        if (!f) {
          errors.push(
            `tags.${key}: unknown facet (known: ${listAnd(FACETS.map((x) => x.key))}).`,
          );
          continue;
        }
        if ('derived' in f && f.derived) {
          errors.push(
            `tags.${key}: is worked out from the ingredients and can't be set.`,
          );
          continue;
        }
        if (raw === null) {
          out = removeMetadata(out, key);
          continue;
        }
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) {
          errors.push(`tags.${key}: must be an array of strings, or null.`);
          continue;
        }
        const values: string[] = [];
        for (const value of raw as string[]) {
          const canon = canonicalValue(key, value);
          if (canon === undefined) {
            errors.push(`tags.${key}: "${value}" is not an allowed value.`);
          } else if (!values.includes(canon)) {
            values.push(canon);
          }
        }
        if (!f.multi && values.length > 1) {
          errors.push(`tags.${key}: takes only one value.`);
        } else if (values.length === 0) {
          out = removeMetadata(out, key);
        } else {
          out = upsertMetadata(out, [[key, values.join(', ')]]);
        }
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, source: out };
}
