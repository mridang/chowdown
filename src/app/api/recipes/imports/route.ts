/**
 * Recipe imports — turning pasted links and text into recipe drafts.
 *
 *   POST /api/recipes/imports   { input }  → 201 with the import and its drafts
 *   GET  /api/recipes/imports               list the user's imports, newest first
 *
 * Each link is fetched server-side and converted to Cooklang by our own
 * converter. Nothing becomes a recipe until the client posts a draft to
 * `/api/recipes`. A link that can't be fetched shows up as a `FAILED` item
 * rather than failing the whole import. One import holds at most ten links and
 * pasted recipes: each one costs a fetch and model calls.
 */

import { NextResponse } from 'next/server';

import { requireLiveUid } from '@/domain/api/auth';
import { budgetRefusal } from '@/domain/api/daily-budget';
import { readJson } from '@/lib/rest-json/json';
import {
  absoluteUrl,
  decodeCursor,
  pageBody,
  parseLimit,
  sliceAfter,
} from '@/core/api/pagination';
import { problems } from '@/lib/rest-json/problem';
import {
  compareImportPositions,
  importPosition,
  importSummary,
  MAX_IMPORT_BODY_BYTES,
  parseImportInput,
} from '@/domain/api/recipe-import-resource';
import {
  createRecipeImport,
  listRecipeImports,
} from '@/domain/db/recipe-imports';
import { MAX_IMPORT_UNITS, planImport } from '@/domain/recipe/import-blob';
import { prepareImport } from '@/domain/recipe/prepare-import';
import { getDatabase, getEnv } from '@/core/runtime';
import { DAILY_BUDGETS } from '@/domain/daily-budget';

/**
 * `POST /api/recipes/imports`: read the links and recipe text in `{ input }`
 * and make drafts of them. Answers 201 with the import and its `Location`, or
 * 400 for a missing or oversized `input`, when nothing in it looks like a link
 * or a recipe, or when it holds more than ten of them; 413 for a request body
 * over 1 MiB; 429 once the person has used the day's import allowance; 415 for a body that is not JSON. Needs a signed-in user: 401
 * without a session.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await readJson(request, [], MAX_IMPORT_BODY_BYTES);
  if (!body.ok) {
    return body.response;
  }
  const input = parseImportInput(body.value);
  if (!input.ok) {
    return problems.badRequest('The import is not valid.', input.errors);
  }

  // Counted before any work starts: every unit costs a fetch and model calls,
  // so the size of one request's bill is decided here, not by the length of
  // the text.
  const units = planImport(input.input);
  if (units.length === 0) {
    return problems.badRequest(
      'No links or recipe text found in what you pasted.',
    );
  }
  if (units.length > MAX_IMPORT_UNITS) {
    return problems.badRequest(
      `That is ${units.length} links and recipes; one import takes at most ${MAX_IMPORT_UNITS}. Split it into smaller imports.`,
      [`input: at most ${MAX_IMPORT_UNITS} links or recipes per import.`],
    );
  }

  const spent = await budgetRefusal(
    DAILY_BUDGETS.import,
    auth.value,
    'recipe import',
  );
  if (spent) {
    return spent;
  }
  const items = await prepareImport(units, getEnv());
  const created = await createRecipeImport(getDatabase(), auth.value, items);
  return NextResponse.json(created, {
    status: 201,
    headers: {
      Location: absoluteUrl(request, `/api/recipes/imports/${created.id}`),
    },
  });
}

/**
 * `GET /api/recipes/imports`: the user's imports, newest first, as summaries
 * (no drafts). Answers 200 with a page, 400 for a bad `limit` or `cursor`, 401
 * when nobody is signed in.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireLiveUid(request);
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
