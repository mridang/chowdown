/**
 * @packageDocumentation
 *
 * Sending a single recipe: the JSON resource (or Cooklang text, or schema.org
 * JSON-LD when the client asks for it), always with its `ETag` so the client
 * can make conditional requests.
 */

import { getRecipePageRows } from '@/domain/db/recipe-page';
import { recipeToJsonLd } from '@/domain/recipe/schema-org';
import { parseRecipe } from '@/lib/cooklang';
import { getDatabase } from '@/domain/db/client';
import { entityTag, ifNoneMatchHit, problems } from '@/lib/core/api';
import {
  representationTag,
  type RecipeRepresentation,
} from '@/domain/recipe/etag';
import { appOrigin } from '@/lib/core/origin';
import { recipeResource } from '@/domain/api/recipe-resource';

/** The media type of a recipe's Cooklang source. */
export const COOKLANG_TYPE = 'text/x-cooklang';
/** The media type of a recipe as schema.org JSON-LD. */
export const JSON_LD_TYPE = 'application/ld+json';

/** Which representation an `Accept` header asks for (JSON by default). */
export function wantedType(accept: string | null): RecipeRepresentation {
  const header = (accept ?? '').toLowerCase();
  if (header.includes(COOKLANG_TYPE)) {
    return 'cooklang';
  }
  if (header.includes(JSON_LD_TYPE)) {
    return 'ld';
  }
  return 'json';
}

/**
 * Read a recipe and send it. `status` is 200 normally, or 201 for a fresh
 * creation. Honours `If-None-Match` (304) on plain reads. `extraHeaders` are
 * added to whichever answer goes out (say, a `Location` for a new recipe).
 */
export async function sendRecipe(
  request: Request,
  userId: number,
  id: string,
  status = 200,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<Response> {
  const rows = await getRecipePageRows(getDatabase(), userId, id);
  if (!rows.recipe) {
    return problems.notFound('recipe');
  }
  const kind = wantedType(request.headers.get('accept'));
  const etag = representationTag(await entityTag(rows.recipe.source), kind);
  const headers: Readonly<Record<string, string>> = {
    ETag: etag,
    Vary: 'Accept',
    'Cache-Control': 'private, no-cache',
    ...extraHeaders,
  };
  if (
    request.method === 'GET' &&
    ifNoneMatchHit(request.headers.get('if-none-match'), etag)
  ) {
    return new Response(null, { status: 304, headers });
  }
  if (kind === 'cooklang') {
    return new Response(rows.recipe.source, {
      status,
      headers: {
        ...headers,
        'Content-Type': `${COOKLANG_TYPE}; charset=utf-8`,
      },
    });
  }
  if (kind === 'ld') {
    const parsed = parseRecipe(rows.recipe.source, rows.recipe.name);
    return Response.json(
      recipeToJsonLd(parsed, `${appOrigin(request)}/recipe/${id}`),
      { status, headers: { ...headers, 'Content-Type': JSON_LD_TYPE } },
    );
  }
  return Response.json(recipeResource(rows.recipe, rows.favourite), {
    status,
    headers,
  });
}
