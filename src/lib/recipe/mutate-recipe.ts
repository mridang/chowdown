/**
 * @packageDocumentation
 *
 * The one place a recipe's Cooklang file is changed on behalf of the REST API
 * (replace, patch, notes). The steps are always the same: confirm the recipe is
 * the caller's, read the *current* file from Drive (the source of truth, which
 * may have been edited there), check the caller's `If-Match` against it, apply
 * the edit, write it back and refresh the cache. The I/O is injected so the
 * rules can be tested.
 */

import { entityTag, ifMatchSatisfied } from '@/lib/rest-json/etag';

/** The side effects a mutation needs. */
export interface MutateDeps {
  /** Whether the caller has this recipe. */
  owns(id: string): Promise<boolean>;
  /** The current file text, or undefined if the file is gone from Drive. */
  read(id: string): Promise<string | undefined>;
  /** Write the new text to Drive and refresh the cache. */
  write(id: string, source: string): Promise<void>;
}

/** What an edit function decides. */
export type Edit<T> =
  | { readonly ok: true; readonly source: string; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] }
  /** The thing being edited (say, one note) doesn't exist. */
  | { readonly ok: false; readonly missing: true };

/** The outcome of a mutation. */
export type MutateOutcome<T> =
  | {
      readonly kind: 'done';
      readonly source: string;
      readonly etag: string;
      readonly value: T;
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'precondition-failed' }
  | { readonly kind: 'invalid'; readonly errors: readonly string[] };

/**
 * Change one recipe. `edit` turns the current source into the new one (or
 * reports why it can't). An edit that changes nothing writes nothing.
 */
export async function mutateRecipe<T>(
  deps: MutateDeps,
  id: string,
  ifMatch: string | null,
  edit: (current: string) => Edit<T>,
): Promise<MutateOutcome<T>> {
  if (!(await deps.owns(id))) {
    return { kind: 'not-found' };
  }
  const current = await deps.read(id);
  if (current === undefined) {
    return { kind: 'not-found' };
  }
  if (!ifMatchSatisfied(ifMatch, await entityTag(current))) {
    return { kind: 'precondition-failed' };
  }
  const result = edit(current);
  if (!result.ok) {
    return 'missing' in result
      ? { kind: 'not-found' }
      : { kind: 'invalid', errors: result.errors };
  }
  if (result.source !== current) {
    await deps.write(id, result.source);
  }
  return {
    kind: 'done',
    source: result.source,
    etag: await entityTag(result.source),
    value: result.value,
  };
}
