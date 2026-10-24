/**
 * The notes on a recipe.
 *
 *   GET  /api/recipes/:id/notes   list them
 *   POST /api/recipes/:id/notes   add one → 201 with the note
 *
 * Notes are Cooklang comments appended to the recipe, so the method itself is
 * never touched.
 */

import { NextResponse } from 'next/server';

import { requireLiveUid, requireUser } from '@/lib/api/auth';
import { driveFailure } from '@/lib/api/drive-failure';
import { readJsonObject } from '@/lib/rest-json/json';
import { settleMutation } from '@/lib/api/mutation-response';
import { noteResource, parseNoteInput } from '@/lib/api/note-resource';
import { absoluteUrl, pageBody } from '@/core/api/pagination';
import { problems } from '@/lib/rest-json/problem';
import type { IdContext } from '@/core/api/route-context';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { appendNote, extractNotes } from '@/lib/cooklang/cook-text';
import { mutateRecipeForUser } from '@/lib/recipe/mutate-recipe-live';
import { getDatabase } from '@/core/runtime';

/**
 * `GET /api/recipes/:id/notes`: the recipe's notes, in order, numbered from 1.
 * Answers 200 with a page of notes, 404 for a recipe the user does not have,
 * 401 when nobody is signed in.
 */
export async function GET(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const row = await getRecipeByFileId(
    getDatabase(),
    auth.value,
    (await params).id,
  );
  if (!row) {
    return problems.notFound('recipe');
  }
  return NextResponse.json(
    pageBody(request, extractNotes(row.source).map(noteResource)),
    { headers: { 'Cache-Control': 'private, no-cache' } },
  );
}

/**
 * `POST /api/recipes/:id/notes`: add a note (`{ text }`, plus `ingredient` or
 * `step` to attach it). Answers 201 with the note, its `Location` and the
 * recipe's new `ETag`. Needs a signed-in user: 401, 400 for a bad note, 404 for
 * an unknown recipe, 412 when `If-Match` is stale, and 409 or 502 when Drive is
 * not connected or fails.
 */
export async function POST(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
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
  const { id } = await params;
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
    return NextResponse.json(note, {
      status: 201,
      headers: {
        Location: absoluteUrl(request, `/api/recipes/${id}/notes/${note.id}`),
        ETag: settled.done.etag,
      },
    });
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the note. Nothing was changed.',
    );
  }
}
