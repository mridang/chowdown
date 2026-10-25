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

import { requireLiveUid, requireUser } from '@/domain/api/auth';
import { driveFailure } from '@/domain/api/drive-failure';
import {
  problems,
  readJson,
  readJsonObject,
  type IdContext,
} from '@/lib/core/api';
import { settleMutation } from '@/domain/api/mutation-response';
import {
  MAX_RECIPE_BODY_BYTES,
  parseReplacementCooklang,
} from '@/domain/api/recipe-input';
import { sendRecipe } from '@/domain/api/recipe-response';
import { deleteRecipeForUser } from '@/domain/recipe/delete-recipe';
import type { MutateOutcome } from '@/domain/recipe/mutate-recipe';
import { mutateRecipeForUser } from '@/domain/recipe/mutate-recipe-live';
import { applyRecipePatch } from '@/domain/recipe/recipe-patch';

/** Turn a mutation outcome into the response to send: a refusal, or the recipe as it now stands. */
async function respond(
  request: Request,
  userId: number,
  id: string,
  outcome: MutateOutcome<null>,
): Promise<Response> {
  const settled = settleMutation(outcome, {
    missing: 'recipe',
    invalid: 'The change is not valid.',
  });
  return settled.ok ? sendRecipe(request, userId, id, 200) : settled.response;
}

/**
 * `GET /api/recipes/:id`: the recipe as JSON, Cooklang text or JSON-LD,
 * whichever `Accept` asks for, with its `ETag`. Answers 304 when
 * `If-None-Match` matches, 404 for a recipe the user does not have, 401 when
 * nobody is signed in.
 */
export async function GET(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  return sendRecipe(request, auth.value, (await params).id);
}

/**
 * `PUT /api/recipes/:id`: replace the recipe's Cooklang text with `{ cooklang }`.
 * Answers 200 with the recipe. Needs a signed-in user: 401, 400 for a bad
 * body, 413 for a body over 1 MiB, 404 for an unknown recipe, 412 when `If-Match` is stale, and 409 or
 * 502 when Drive is not connected or fails.
 */
export async function PUT(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request, [], MAX_RECIPE_BODY_BYTES);
  if (!body.ok) {
    return body.response;
  }
  const input = parseReplacementCooklang(body.value);
  if (!input.ok) {
    return problems.badRequest('The recipe is not valid.', input.errors);
  }
  const { cooklang } = input;
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

/**
 * `PATCH /api/recipes/:id`: edit the recipe's title, images or tags with a JSON
 * Merge Patch. Answers 200 with the recipe. Needs a signed-in user: 401, 400
 * for a patch that is not valid, 404 for an unknown recipe, 412 when
 * `If-Match` is stale, and 409 or 502 when Drive is not connected or fails.
 */
export async function PATCH(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJsonObject(
    request,
    'The patch must be a JSON object.',
    ['application/merge-patch+json'],
  );
  if (!body.ok) {
    return body.response;
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

/**
 * `DELETE /api/recipes/:id`: delete the recipe; its Drive file goes to the
 * trash. Answers 204, or 404 for a recipe the user does not have. Needs a
 * signed-in user: 401, and 409 or 502 when Drive is not connected or fails.
 */
export async function DELETE(
  request: Request,
  { params }: IdContext,
): Promise<Response> {
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
