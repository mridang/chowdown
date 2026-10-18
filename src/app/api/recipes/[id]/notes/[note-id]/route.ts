/**
 * One note on a recipe. The id is the note's position ("1" is the first); send
 * the recipe's `ETag` as `If-Match` so a shifted position can't hit the wrong
 * note.
 *
 *   GET    /api/recipes/:id/notes/:note-id
 *   PUT    /api/recipes/:id/notes/:note-id   replace it
 *   DELETE /api/recipes/:id/notes/:note-id
 */

import { NextResponse } from 'next/server';

import { requireUid, requireUser } from '@/lib/api/auth';
import { isObject, readJson } from '@/lib/api/json';
import {
  noteIndex,
  noteResource,
  parseNoteInput,
} from '@/lib/api/note-resource';
import { driveFailure } from '@/lib/api/drive-failure';
import { problems } from '@/lib/api/problem';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { extractNotes, removeNote, replaceNote } from '@/lib/recipe/cook-text';
import { mutateRecipeForUser } from '@/lib/recipe/mutate-recipe-live';
import { getDatabase } from '@/lib/util';

type Context = { params: Promise<{ id: string; 'note-id': string }> };

export async function GET(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { id, 'note-id': noteId } = await params;
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

export async function PUT(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  if (!isObject(body.value)) {
    return problems.badRequest('The request body must be a JSON object.');
  }
  const input = parseNoteInput(body.value);
  if (!input.ok) {
    return problems.badRequest('The note is not valid.', input.errors);
  }
  const { id, 'note-id': noteId } = await params;
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
    if (outcome.kind === 'not-found') {
      return problems.notFound('note');
    }
    if (outcome.kind === 'precondition-failed') {
      return problems.preconditionFailed();
    }
    if (outcome.kind === 'invalid') {
      return problems.badRequest('The note is not valid.', outcome.errors);
    }
    return NextResponse.json(noteResource(input.note, index), {
      headers: { ETag: outcome.etag },
    });
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the note. Nothing was changed.',
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { id, 'note-id': noteId } = await params;
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
    if (outcome.kind === 'not-found') {
      return problems.notFound('note');
    }
    if (outcome.kind === 'precondition-failed') {
      return problems.preconditionFailed();
    }
    if (outcome.kind === 'invalid') {
      return problems.badRequest('The change is not valid.', outcome.errors);
    }
    return new NextResponse(null, {
      status: 204,
      headers: { ETag: outcome.etag },
    });
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the change. Nothing was changed.',
    );
  }
}
