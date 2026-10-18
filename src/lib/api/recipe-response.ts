/**
 * @packageDocumentation
 *
 * Sending a single recipe: the JSON resource (or Cooklang text, or schema.org
 * JSON-LD when the client asks for it), always with its `ETag` so the client
 * can make conditional requests.
 */

import { NextResponse } from 'next/server';

import { getRecipePageRows } from '../db/recipe-page';
import { recipeToJsonLd } from '../recipe/schema-org';
import { parseRecipe } from '../recipe/cooklang';
import { getDatabase } from '../util';
import { entityTag, ifNoneMatchHit, representationTag } from './etag';
import { problems } from './problem';
import { absoluteUrl } from './pagination';
import { recipeResource } from './recipe-resource';

/** The representations a recipe can be requested in. */
export const COOKLANG_TYPE = 'text/x-cooklang';
export const JSON_LD_TYPE = 'application/ld+json';

/** Which representation an `Accept` header asks for (JSON by default). */
export function wantedType(accept: string | null): 'json' | 'cooklang' | 'ld' {
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
 * creation. Honours `If-None-Match` (304) on plain reads.
 */
export async function sendRecipe(
  request: Request,
  userId: number,
  id: string,
  status = 200,
): Promise<NextResponse> {
  const rows = await getRecipePageRows(getDatabase(), userId, id);
  if (!rows.recipe) {
    return problems.notFound('recipe');
  }
  const kind = wantedType(request.headers.get('accept'));
  const etag = representationTag(await entityTag(rows.recipe.source), kind);
  const headers: Record<string, string> = {
    ETag: etag,
    Vary: 'Accept',
    'Cache-Control': 'private, no-cache',
  };
  if (
    request.method === 'GET' &&
    ifNoneMatchHit(request.headers.get('if-none-match'), etag)
  ) {
    return new NextResponse(null, { status: 304, headers });
  }
  if (kind === 'cooklang') {
    return new NextResponse(rows.recipe.source, {
      status,
      headers: {
        ...headers,
        'Content-Type': `${COOKLANG_TYPE}; charset=utf-8`,
      },
    });
  }
  if (kind === 'ld') {
    const parsed = parseRecipe(rows.recipe.source, rows.recipe.name);
    return NextResponse.json(
      recipeToJsonLd(parsed, absoluteUrl(request, `/recipe/${id}`)),
      { status, headers: { ...headers, 'Content-Type': JSON_LD_TYPE } },
    );
  }
  return NextResponse.json(recipeResource(rows.recipe, rows.favourite), {
    status,
    headers,
  });
}
