/**
 * @packageDocumentation
 *
 * The request behind "Save note" on a recipe page, apart from the form so the
 * outcome can be decided (and checked) without a browser.
 */

import { problemError, problemText } from '@/components/api/problem-message';

/** How saving a note ended: saved, or the sentence to show the person. */
export type NoteResult =
  | Readonly<{ saved: true }>
  | Readonly<{ saved: false; message: string }>;

/**
 * Save a personal note on a recipe (`POST /api/recipes/:id/notes`). The note is
 * trimmed; `ingredient` attaches it to one ingredient, and an empty one means
 * the whole recipe. Never throws: a refusal carries the server's own words,
 * anything else a fixed sentence.
 *
 * @param recipeId The recipe the note belongs to.
 * @param text What the person wrote.
 * @param ingredient The ingredient it is about, or `''` for the whole recipe.
 */
export async function postNote(
  recipeId: string,
  text: string,
  ingredient: string,
): Promise<NoteResult> {
  try {
    const res = await fetch(`/api/recipes/${recipeId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        ingredient: ingredient || undefined,
      }),
    });
    if (!res.ok) {
      throw await problemError(res);
    }
    return { saved: true };
  } catch (error) {
    return {
      saved: false,
      message: problemText(error, 'Could not save the note.'),
    };
  }
}
