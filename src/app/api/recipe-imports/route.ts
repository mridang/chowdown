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
import { isObject, readJson } from '@/lib/api/json';
import {
  absoluteUrl,
  decodeCursor,
  pageBody,
  parseLimit,
  sliceAfter,
} from '@/lib/api/pagination';
import { problems } from '@/lib/api/problem';
import { createRecipeImport, listRecipeImports } from '@/lib/db/recipe-imports';
import { prepareImport } from '@/lib/recipe/prepare-import';
import { getDatabase, getEnv } from '@/lib/util';

/** Largest pasted blob accepted. */
const MAX_INPUT = 100_000;

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  const input = isObject(body.value) ? body.value['input'] : undefined;
  if (typeof input !== 'string' || !input.trim()) {
    return problems.badRequest('The import is not valid.', [
      'input: required.',
    ]);
  }
  if (input.length > MAX_INPUT) {
    return problems.badRequest('The import is not valid.', [
      'input: too large.',
    ]);
  }

  const items = await prepareImport(input.trim(), getEnv());
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
    (i) => ({ key: i.created_at, id: i.id }),
    (a, b) =>
      a.key === b.key ? a.id.localeCompare(b.id) : b.key.localeCompare(a.key),
    after,
    limit,
  );
  return NextResponse.json(
    pageBody(
      request,
      page.items.map((i) => ({
        id: i.id,
        status: i.status,
        created_at: i.created_at,
        item_count: i.items.length,
      })),
      page.next,
    ),
    { headers: { 'Cache-Control': 'private, no-cache' } },
  );
}
