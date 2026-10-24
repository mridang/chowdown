/**
 * One note on a recipe. The id is the note's position ("1" is the first); send
 * the recipe's `ETag` as `If-Match` so a shifted position can't hit the wrong
 * note.
 *
 *   GET    /api/recipes/:id/notes/:note_id
 *   PUT    /api/recipes/:id/notes/:note_id   replace it
 *   DELETE /api/recipes/:id/notes/:note_id
 */

import { NextResponse } from 'next/server';

import { requireLiveUid, requireUser } from '@/lib/api/auth';
import { driveFailure } from '@/lib/api/drive-failure';
import { readJsonObject } from '@/lib/api/json';
import { settleMutation } from '@/lib/api/mutation-response';
import {
  noteIndex,
  noteResource,
  parseNoteInput,
} from '@/lib/api/note-resource';
import { problems } from '@/lib/api/problem';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { extractNotes, removeNote, replaceNote } from '@/lib/recipe/cook-text';
import { mutateRecipeForUser } from '@/lib/recipe/mutate-recipe-live';
import { getDatabase } from '@/lib/util/runtime';

/** The context Next.js hands these handlers: the recipe id and the note's position. */
interface NoteContext {
  readonly params: Promise<{ readonly id: string; readonly note_id: string }>;
}

/**
 * `GET /api/recipes/:id/notes/:note_id`: one note. Answers 200 with the note,
 * 404 when the recipe or the note does not exist, 401 when nobody is signed in.
 */
export async function GET(
  request: Request,
  { params }: NoteContext,
): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { id, note_id: noteId } = await params;
  const row = await getRecipeByFileId(getDatabase(), auth.value, id);
  const index = noteIndex(noteId);
  const note =
    row && index !== undefined ? extractNotes(row.source)[index] : undefined;
  if (!note || index === undefined) {
    return problems.notFound('note');
  }
  return NextResponse.json(noteResource(note, index), {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}

/**
 * `PUT /api/recipes/:id/notes/:note_id`: replace the note with a new one
 * (`{ text }`, plus `ingredient` or `step`). Answers 200 with the note and the
 * recipe's new `ETag`. Needs a signed-in user: 401, 400 for a bad note, 404
 * when the recipe or note does not exist, 412 when `If-Match` is stale, and
 * 409 or 502 when Drive is not connected or fails.
 */
export async function PUT(
  request: Request,
  { params }: NoteContext,
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
  const { id, note_id: noteId } = await params;
  const index = noteIndex(noteId);
  if (index === undefined) {
    return problems.notFound('note');
  }
  try {
    const outcome = await mutateRecipeForUser(
      auth.value,
      id,
      request.headers.get('if-match'),
      (current) => {
        const updated = replaceNote(current, index, input.note);
        return updated === undefined
          ? { ok: false, missing: true }
          : { ok: true, source: updated, value: null };
      },
    );
    const settled = settleMutation(outcome, {
      missing: 'note',
      invalid: 'The note is not valid.',
    });
    return settled.ok
      ? NextResponse.json(noteResource(input.note, index), {
          headers: { ETag: settled.done.etag },
        })
      : settled.response;
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the note. Nothing was changed.',
    );
  }
}

/**
 * `DELETE /api/recipes/:id/notes/:note_id`: remove the note. Answers 204 with
 * the recipe's new `ETag`. Needs a signed-in user: 401, 404 when the recipe or
 * note does not exist, 412 when `If-Match` is stale, and 409 or 502 when Drive
 * is not connected or fails.
 */
export async function DELETE(
  request: Request,
  { params }: NoteContext,
): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { id, note_id: noteId } = await params;
  const index = noteIndex(noteId);
  if (index === undefined) {
    return problems.notFound('note');
  }
  try {
    const outcome = await mutateRecipeForUser(
      auth.value,
      id,
      request.headers.get('if-match'),
      (current) => {
        const updated = removeNote(current, index);
        return updated === undefined
          ? { ok: false, missing: true }
          : { ok: true, source: updated, value: null };
      },
    );
    const settled = settleMutation(outcome, {
      missing: 'note',
      invalid: 'The change is not valid.',
    });
    return settled.ok
      ? new NextResponse(null, {
          status: 204,
          headers: { ETag: settled.done.etag },
        })
      : settled.response;
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the change. Nothing was changed.',
    );
  }
}
