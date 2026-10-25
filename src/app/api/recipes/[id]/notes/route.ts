/**
 * The notes on a recipe.
 *
 *   GET  /api/recipes/:id/notes   list them
 *   POST /api/recipes/:id/notes   add one → 201 with the note
 *
 * Notes are Cooklang comments appended to the recipe, so the method itself is
 * never touched.
 *
 * The behaviour lives in the `notesCollection` controller; the exported
 * handlers only mount it.
 */

import { requireLiveUid, requireUser } from '@/domain/api/auth';
import { driveFailure } from '@/domain/api/drive-failure';
import {
  ApiController,
  created,
  page,
  problems,
  readJsonObject,
} from '@/lib/core/api';
import { settleMutation } from '@/domain/api/mutation-response';
import { noteResource, parseNoteInput } from '@/domain/api/note-resource';
import { getRecipeByFileId } from '@/domain/db/recipes';
import { appendNote, extractNotes } from '@/lib/cooklang';
import { mutateRecipeForUser } from '@/domain/recipe/mutate-recipe-live';
import { getDatabase } from '@/domain/db/client';

export const dynamic = 'force-dynamic';

/** The request and the recipe id from the path. */
interface NotesContext {
  readonly request: Request;
  readonly id: string;
}

/**
 * The recipe-notes collection controller.
 *
 * `GET /api/recipes/:id/notes`: the recipe's notes, in order, numbered from 1.
 * Answers 200 with a page of notes, 404 for a recipe the user does not have,
 * 401 when nobody is signed in.
 *
 * `POST /api/recipes/:id/notes`: add a note (`{ text }`, plus `ingredient` or
 * `step` to attach it). Answers 201 with the note, its `Location` and the
 * recipe's new `ETag`. Needs a signed-in user: 401, 400 for a bad note, 404 for
 * an unknown recipe, 412 when `If-Match` is stale, and 409 or 502 when Drive is
 * not connected or fails.
 */
const notesCollection = new ApiController<NotesContext>({
  context: async (request, route) => ({
    request,
    id: (await route.params)?.['id'] ?? '',
  }),
})
  .on({
    method: 'GET',
    handle: async (_input, { request, id }) => {
      const auth = await requireLiveUid(request);
      if (!auth.ok) {
        return auth.response;
      }
      const row = await getRecipeByFileId(getDatabase(), auth.value, id);
      if (!row) {
        return problems.notFound('recipe');
      }
      return page(extractNotes(row.source).map(noteResource), undefined, {
        'Cache-Control': 'private, no-cache',
      });
    },
    encode: (result) => result,
  })
  .on({
    method: 'POST',
    handle: async (_input, { request, id }) => {
      const auth = await requireUser(request);
      if (!auth.ok) {
        return auth.response;
      }
      const body = await readJsonObject(
        request,
        'The request body must be a JSON object.',
      );
      if (!body.ok) {
        return body.response;
      }
      const input = parseNoteInput(body.value);
      if (!input.ok) {
        return problems.badRequest('The note is not valid.', input.errors);
      }
      try {
        const outcome = await mutateRecipeForUser(
          auth.value,
          id,
          request.headers.get('if-match'),
          (current) => ({
            ok: true,
            source: appendNote(current, input.note),
            value: extractNotes(current).length,
          }),
        );
        const settled = settleMutation(outcome, {
          missing: 'recipe',
          invalid: 'The note is not valid.',
        });
        if (!settled.ok) {
          return settled.response;
        }
        const note = noteResource(input.note, settled.done.value);
        return created(note, `/api/recipes/${id}/notes/${note.id}`, {
          ETag: settled.done.etag,
        });
      } catch (error) {
        return driveFailure(
          error,
          'Google Drive could not save the note. Nothing was changed.',
        );
      }
    },
    encode: (result) => result,
  });

export const { GET, POST } = notesCollection.handlers();
