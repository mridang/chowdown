/**
 * @packageDocumentation
 *
 * Turning the outcome of changing a recipe (see `recipe/mutate-recipe.ts`) into
 * either the finished change or the problem response for each way it can fail.
 * The routes that change a recipe or one of its notes share this, so they
 * refuse in the same words.
 */

import type { MutateOutcome } from '@/lib/recipe/mutate-recipe';
import { problems } from '@/lib/rest-json/problem';

/** How a route words the failures that depend on what it was changing. */
export interface MutationWording {
  /** What was not found: `recipe` or `note`. */
  readonly missing: string;
  /** The sentence for a change that was refused as invalid. */
  readonly invalid: string;
}

/** The part of a mutation outcome that means the change was made. */
export type DoneMutation<T> = Extract<MutateOutcome<T>, { kind: 'done' }>;

/** The finished change, or the problem response to send instead. */
export type SettledMutation<T> =
  | { readonly ok: true; readonly done: DoneMutation<T> }
  | { readonly ok: false; readonly response: Response };

/**
 * Sort a mutation outcome into the finished change or the response for why it
 * did not happen: 404 (nothing to change), 412 (the `If-Match` was stale) or
 * 400 (the change was not valid).
 */
export function settleMutation<T>(
  outcome: MutateOutcome<T>,
  wording: MutationWording,
): SettledMutation<T> {
  switch (outcome.kind) {
    case 'done':
      return { ok: true, done: outcome };
    case 'not-found':
      return { ok: false, response: problems.notFound(wording.missing) };
    case 'precondition-failed':
      return { ok: false, response: problems.preconditionFailed() };
    case 'invalid':
      return {
        ok: false,
        response: problems.badRequest(wording.invalid, outcome.errors),
      };
  }
}
