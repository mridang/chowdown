/**
 * @packageDocumentation
 *
 * The request behind renaming a recipe on its page, apart from the form so the
 * outcome can be decided (and checked) without a browser.
 */

import { problemError, problemText } from '@/components/api/problem-message';

/** How renaming ended: saved, or the sentence to show the person. */
export type TitleResult =
  Readonly<{ saved: true }> | Readonly<{ saved: false; message: string }>;

/** What to say when the recipe was changed somewhere else since the page loaded. */
export const CHANGED_ELSEWHERE =
  'This recipe was changed somewhere else. Reload the page to see the latest version, then edit the title again.';

/** What to say when the request failed outright, with no answer from the server. */
export const COULD_NOT_RENAME = 'Could not save the title.';

/** The HTTP status for a failed `If-Match` precondition. */
const PRECONDITION_FAILED = 412;

/**
 * Rename a recipe (`PATCH /api/recipes/:id`, a JSON Merge Patch). `etag` is the
 * tag of the recipe the person is looking at, sent as `If-Match` so an edit made
 * elsewhere in the meantime is refused rather than overwritten. Never throws: a
 * refusal carries the server's own words (the title is empty, Drive is not
 * connected), a stale `etag` a fixed sentence about reloading, anything else a
 * plain one.
 * @param recipeId - The recipe to rename.
 * @param title - The new title; the server trims it and collapses spaces.
 * @param etag - The recipe's entity tag as the page loaded it.
 */
export async function patchTitle(
  recipeId: string,
  title: string,
  etag: string,
): Promise<TitleResult> {
  try {
    const res = await fetch(`/api/recipes/${recipeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'If-Match': etag,
      },
      body: JSON.stringify({ title }),
    });
    if (res.status === PRECONDITION_FAILED) {
      return { saved: false, message: CHANGED_ELSEWHERE };
    }
    if (!res.ok) {
      throw await problemError(res);
    }
    return { saved: true };
  } catch (error) {
    return {
      saved: false,
      message: problemText(error, COULD_NOT_RENAME),
    };
  }
}
