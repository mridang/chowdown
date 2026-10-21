/**
 * Recipe suggestions for a free-text wish — the "what do you feel like?" box.
 * The recipes are ranked by how close their meaning is to the text (Workers AI
 * embeddings against the cached recipe embeddings), best first.
 *
 *   GET /api/recipes/suggestions?q=something light with chicken&limit=8
 *
 * No page of the app calls this endpoint today: it is part of the documented
 * API for other clients. It is also the most expensive read there is (it can
 * fetch and embed every recipe file in Drive, then embeds `q`), so `q` is
 * capped and the route is the first candidate for a per-user rate limit.
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { driveFailure } from '@/lib/api/drive-failure';
import { pageBody, parseLimit } from '@/lib/api/pagination';
import { budgetRefusal } from '@/lib/api/daily-budget';
import { problems } from '@/lib/api/problem';
import { getUserAccessToken } from '@/lib/auth/user-access-token';
import { listRecipeFiles } from '@/lib/drive/drive-client';
import { recipesFolderFor } from '@/lib/drive/recipes-folder';
import { recipeDisplayName } from '@/lib/recipe/cook-text';
import { embedText } from '@/lib/recipe/embeddings';
import { ensureEmbeddings, topSimilar } from '@/lib/recipe/similar';
import { getEnv } from '@/lib/util';
import { DAILY_BUDGETS } from '@/lib/util/daily-budget';

/** How many suggestions to give when the client does not say. */
const DEFAULT_SUGGESTIONS = 8;

/**
 * The longest wish accepted, in characters. It goes straight to the embedding
 * model; a sentence or two is all a wish ever needs.
 */
const MAX_QUERY_LENGTH = 300;

/**
 * `GET /api/recipes/suggestions?q=…&limit=…`: the user's recipes closest in
 * meaning to the text in `q`, best first, as `{ id, title }` entries. Answers
 * 200 with a page, 400 for a missing or over-long (300 characters) `q` or a bad
 * `limit`. Needs a signed-in user: 401, and 502 or 409 when Drive or the model
 * is unavailable.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const query = new URL(request.url).searchParams;
  const q = query.get('q')?.trim();
  if (!q) {
    return problems.badRequest('q is required.');
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return problems.badRequest(
      `q must be at most ${MAX_QUERY_LENGTH} characters.`,
    );
  }
  const limit = parseLimit(query.get('limit'), DEFAULT_SUGGESTIONS);
  if (typeof limit !== 'number') {
    return limit;
  }
  const spent = await budgetRefusal(
    DAILY_BUDGETS.suggest,
    auth.value.id,
    'search',
  );
  if (spent) {
    return spent;
  }

  try {
    const user = auth.value;
    const token = await getUserAccessToken(user);
    const files = await listRecipeFiles(
      await recipesFolderFor(user, token),
      token,
    );
    const rows = await ensureEmbeddings(user, files, token);
    const matched = topSimilar(
      rows,
      await embedText(getEnv(), q),
      files,
      limit,
    );
    return NextResponse.json(
      pageBody(
        request,
        matched.map((f) => ({ id: f.id, title: recipeDisplayName(f.name) })),
      ),
      { headers: { 'Cache-Control': 'private, no-cache' } },
    );
  } catch (error) {
    return driveFailure(error, 'Suggestions are unavailable right now.');
  }
}
