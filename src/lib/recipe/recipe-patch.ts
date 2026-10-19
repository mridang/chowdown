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
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly errors: readonly string[] };

/** The fields a patch may mention. */
const EDITABLE = ['title', 'images', 'tags'] as const;

/** The source so far and the complaints collected while editing it. */
interface PatchState {
  readonly source: string;
  readonly errors: readonly string[];
}

/** A state with one more complaint and the source unchanged. */
function failed(state: PatchState, error: string): PatchState {
  return { source: state.source, errors: [...state.errors, error] };
}

/** A state with new source and the complaints so far. */
function edited(state: PatchState, source: string): PatchState {
  return { source, errors: state.errors };
}

/** Whether a value is an array made only of strings. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Set the title, or complain that it isn't a usable one. */
function patchTitle(state: PatchState, title: unknown): PatchState {
  if (typeof title !== 'string' || !title.trim()) {
    return failed(state, 'title: must be a non-empty string.');
  }
  return edited(
    state,
    upsertMetadata(state.source, [
      ['title', title.trim().replace(/\s+/g, ' ')],
    ]),
  );
}

/** Replace or remove the images, or complain that the list isn't usable. */
function patchImages(state: PatchState, images: unknown): PatchState {
  if (images === null) {
    return edited(state, removeMetadata(state.source, 'images'));
  }
  if (!isStringArray(images)) {
    return failed(
      state,
      'images: must be an array of URLs, or null to remove them.',
    );
  }
  if (images.length === 0) {
    return edited(state, removeMetadata(state.source, 'images'));
  }
  if (validImageUrls(images).length === 0) {
    return failed(
      state,
      'images: none of the URLs are usable http(s) image URLs.',
    );
  }
  return edited(state, withImages(state.source, images));
}

/** Set, replace or remove the values of one facet. */
function patchFacet(state: PatchState, key: string, raw: unknown): PatchState {
  const f = facet(key);
  if (!f) {
    return failed(
      state,
      `tags.${key}: unknown facet (known: ${listAnd(FACETS.map((x) => x.key))}).`,
    );
  }
  if (f.derived) {
    return failed(
      state,
      `tags.${key}: is worked out from the ingredients and can't be set.`,
    );
  }
  if (raw === null) {
    return edited(state, removeMetadata(state.source, key));
  }
  if (!isStringArray(raw)) {
    return failed(state, `tags.${key}: must be an array of strings, or null.`);
  }
  const checked = raw.map((value) => ({
    value,
    canon: canonicalValue(key, value),
  }));
  const rejected = checked.flatMap(({ value, canon }) =>
    canon === undefined
      ? [`tags.${key}: "${value}" is not an allowed value.`]
      : [],
  );
  const values = [
    ...new Set(
      checked.flatMap(({ canon }) => (canon === undefined ? [] : [canon])),
    ),
  ];
  const withRejections: PatchState = {
    source: state.source,
    errors: [...state.errors, ...rejected],
  };
  if (!f.multi && values.length > 1) {
    return failed(withRejections, `tags.${key}: takes only one value.`);
  }
  return edited(
    withRejections,
    values.length === 0
      ? removeMetadata(state.source, key)
      : upsertMetadata(state.source, [[key, values.join(', ')]]),
  );
}

/** Apply each facet in the `tags` object in turn, or complain it isn't one. */
function patchTags(state: PatchState, tags: unknown): PatchState {
  if (typeof tags !== 'object' || tags === null || Array.isArray(tags)) {
    return failed(state, 'tags: must be an object of facet → values.');
  }
  return Object.entries(tags).reduce(
    (soFar, [key, raw]) => patchFacet(soFar, key, raw),
    state,
  );
}

/** Apply a merge patch to a recipe's source. */
export function applyRecipePatch(
  source: string,
  patch: Readonly<Record<string, unknown>>,
): PatchResult {
  const notEditable = Object.keys(patch).flatMap((key) =>
    EDITABLE.some((field) => field === key)
      ? []
      : [`${key}: not editable here (editable: ${listAnd(EDITABLE)}).`],
  );
  const start: PatchState = { source, errors: notEditable };
  const withTitle =
    'title' in patch ? patchTitle(start, patch['title']) : start;
  const withImagesDone =
    'images' in patch ? patchImages(withTitle, patch['images']) : withTitle;
  const done =
    'tags' in patch ? patchTags(withImagesDone, patch['tags']) : withImagesDone;
  return done.errors.length > 0
    ? { ok: false, errors: done.errors }
    : { ok: true, source: done.source };
}
