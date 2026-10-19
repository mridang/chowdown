/**
 * Recipe imports — turning pasted links and text into recipe drafts.
 *
 *   POST /api/recipe-imports   { input }  → 201 with the import and its drafts
 *   GET  /api/recipe-imports               list the user's imports, newest first
 *
 * Each link is fetched server-side and converted to Cooklang by our own
 * converter. Nothing becomes a recipe until the client posts a draft to
 * `/api/recipes`. A link that can't be fetched shows up as a `FAILED` item
 * rather than failing the whole import.
 */

import { NextResponse } from 'next/server';

import { requireUid } from '@/lib/api/auth';
import { readJson } from '@/lib/api/json';
import {
  absoluteUrl,
  decodeCursor,
  pageBody,
  parseLimit,
  sliceAfter,
} from '@/lib/api/pagination';
import { problems } from '@/lib/api/problem';
import {
  compareImportPositions,
  importPosition,
  importSummary,
  parseImportInput,
} from '@/lib/api/recipe-import-resource';
import { createRecipeImport, listRecipeImports } from '@/lib/db/recipe-imports';
import { prepareImport } from '@/lib/recipe/prepare-import';
import { getDatabase, getEnv } from '@/lib/util';

/**
 * `POST /api/recipe-imports`: read the links and recipe text in `{ input }`
 * and make drafts of them. Answers 201 with the import and its `Location`, or
 * 400 for a missing or oversized `input` or when nothing in it looks like a
 * link or a recipe. Needs a signed-in user: 401 without a session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  const input = parseImportInput(body.value);
  if (!input.ok) {
    return problems.badRequest('The import is not valid.', input.errors);
  }

  const items = await prepareImport(input.input, getEnv());
  if (items.length === 0) {
    return problems.badRequest(
      'No links or recipe text found in what you pasted.',
    );
  }
  const created = await createRecipeImport(getDatabase(), auth.value, items);
  return NextResponse.json(created, {
    status: 201,
    headers: {
      Location: absoluteUrl(request, `/api/recipe-imports/${created.id}`),
    },
  });
}

/**
 * `GET /api/recipe-imports`: the user's imports, newest first, as summaries
 * (no drafts). Answers 200 with a page, 400 for a bad `limit` or `cursor`, 401
 * when nobody is signed in.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const query = new URL(request.url).searchParams;
  const limit = parseLimit(query.get('limit'));
  if (typeof limit !== 'number') {
    return limit;
  }
  const cursor = query.get('cursor');
  const after = cursor ? decodeCursor(cursor) : undefined;
  if (cursor && !after) {
    return problems.badRequest('The cursor is not valid.');
  }

  // Newest first: sort keys descend, so "after" means an older key.
  const all = await listRecipeImports(getDatabase(), auth.value);
  const page = sliceAfter(
    all,
    importPosition,
    compareImportPositions,
    after,
    limit,
  );
  return NextResponse.json(
    pageBody(request, page.items.map(importSummary), page.next),
    { headers: { 'Cache-Control': 'private, no-cache' } },
  );
}
