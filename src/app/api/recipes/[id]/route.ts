/**
 * One recipe.
 *
 *   GET    /api/recipes/:id   read it (JSON, Cooklang text, or schema.org JSON-LD)
 *   PUT    /api/recipes/:id   replace its Cooklang text
 *   PATCH  /api/recipes/:id   edit title, images or tags (JSON Merge Patch)
 *   DELETE /api/recipes/:id   delete it (the Drive file goes to the trash)
 *
 * Every response carries an `ETag`. Send it back as `If-Match` on PUT/PATCH to
 * be refused (412) if the recipe changed in the meantime, or as `If-None-Match`
 * on GET to get a 304 when it hasn't.
 */

import { NextResponse } from 'next/server';

import { requireUid, requireUser } from '@/lib/api/auth';
import { isObject, readJson } from '@/lib/api/json';
import { driveFailure } from '@/lib/api/drive-failure';
import { problems } from '@/lib/api/problem';
import { sendRecipe } from '@/lib/api/recipe-response';
import { deleteRecipeForUser } from '@/lib/recipe/delete-recipe';
import { mutateRecipeForUser } from '@/lib/recipe/mutate-recipe-live';
import { applyRecipePatch } from '@/lib/recipe/recipe-patch';
import type { MutateOutcome } from '@/lib/recipe/mutate-recipe';

type Context = { params: Promise<{ id: string }> };

const MAX_COOKLANG_BYTES = 200_000;

/** Turn a mutation outcome into the response to send. */
async function respond(
  request: Request,
  userId: number,
  id: string,
  outcome: MutateOutcome<null>,
): Promise<NextResponse> {
  switch (outcome.kind) {
    case 'not-found':
      return problems.notFound('recipe');
    case 'precondition-failed':
      return problems.preconditionFailed();
    case 'invalid':
      return problems.badRequest('The change is not valid.', outcome.errors);
    case 'done':
      return sendRecipe(request, userId, id, 200);
  }
}

export async function GET(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  return sendRecipe(request, auth.value, (await params).id);
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
  const cooklang = isObject(body.value) ? body.value['cooklang'] : undefined;
  if (
    typeof cooklang !== 'string' ||
    !cooklang.trim() ||
    cooklang.length > MAX_COOKLANG_BYTES
  ) {
    return problems.badRequest('The recipe is not valid.', [
      'cooklang: required.',
    ]);
  }
  const { id } = await params;
  try {
    const outcome = await mutateRecipeForUser(
      auth.value,
      id,
      request.headers.get('if-match'),
      () => ({ ok: true, source: cooklang, value: null }),
    );
    return await respond(request, auth.value.id, id, outcome);
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the recipe. Nothing was changed.',
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: Context,
): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request, ['application/merge-patch+json']);
  if (!body.ok) {
    return body.response;
  }
  if (!isObject(body.value)) {
    return problems.badRequest('The patch must be a JSON object.');
  }
  const patch = body.value;
  const { id } = await params;
  try {
    const outcome = await mutateRecipeForUser(
      auth.value,
      id,
      request.headers.get('if-match'),
      (current) => {
        const result = applyRecipePatch(current, patch);
        return result.ok
          ? { ok: true, source: result.source, value: null }
          : result;
      },
    );
    return await respond(request, auth.value.id, id, outcome);
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not save the recipe. Nothing was changed.',
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
  try {
    const outcome = await deleteRecipeForUser(auth.value, (await params).id);
    return outcome === 'deleted'
      ? new NextResponse(null, { status: 204 })
      : problems.notFound('recipe');
  } catch (error) {
    return driveFailure(
      error,
      'Google Drive could not delete the recipe. Nothing was changed.',
    );
  }
}
