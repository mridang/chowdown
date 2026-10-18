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

import { requireUid, requireUser } from '@/lib/api/auth';
import { isObject, readJson } from '@/lib/api/json';
import { noteResource, parseNoteInput } from '@/lib/api/note-resource';
import { absoluteUrl, pageBody } from '@/lib/api/pagination';
import { problems } from '@/lib/api/problem';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { appendNote, extractNotes } from '@/lib/recipe/cook-text';
import { mutateRecipeForUser } from '@/lib/recipe/mutate-recipe-live';
import { getDatabase } from '@/lib/util';

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
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

export async function POST(
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
    if (outcome.kind === 'not-found') {
      return problems.notFound('recipe');
    }
    if (outcome.kind === 'precondition-failed') {
      return problems.preconditionFailed();
    }
    if (outcome.kind === 'invalid') {
      return problems.badRequest('The note is not valid.', outcome.errors);
    }
    const note = noteResource(input.note, outcome.value);
    return NextResponse.json(note, {
      status: 201,
      headers: {
        Location: absoluteUrl(request, `/api/recipes/${id}/notes/${note.id}`),
        ETag: outcome.etag,
      },
    });
  } catch {
    return problems.upstream(
      'Google Drive could not save the note. Nothing was changed.',
    );
  }
}
