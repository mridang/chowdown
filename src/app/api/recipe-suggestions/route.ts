/**
 * Recipe suggestions for a free-text wish — the "what do you feel like?" box.
 * The recipes are ranked by how close their meaning is to the text (Workers AI
 * embeddings against the cached recipe embeddings), best first.
 *
 *   GET /api/recipe-suggestions?q=something light with chicken&limit=8
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/api/auth';
import { driveFailure } from '@/lib/api/drive-failure';
import { pageBody, parseLimit } from '@/lib/api/pagination';
import { problems } from '@/lib/api/problem';
import { getUserAccessToken } from '@/lib/auth/current-user';
import { listRecipeFiles } from '@/lib/drive/drive-client';
import { recipesFolderFor } from '@/lib/drive/recipes-folder';
import { recipeDisplayName } from '@/lib/recipe/cook-text';
import { embedText } from '@/lib/recipe/embeddings';
import { ensureEmbeddings, topSimilar } from '@/lib/recipe/similar';
import { getEnv } from '@/lib/util';

/** How many suggestions to give when the client does not say. */
const DEFAULT_SUGGESTIONS = 8;

/**
 * `GET /api/recipe-suggestions?q=…&limit=…`: the user's recipes closest in
 * meaning to the text in `q`, best first, as `{ id, title }` entries. Answers
 * 200 with a page, 400 for a missing `q` or a bad `limit`. Needs a signed-in
 * user: 401, and 502 or 409 when Drive or the model is unavailable.
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
  const limit = parseLimit(query.get('limit'), DEFAULT_SUGGESTIONS);
  if (typeof limit !== 'number') {
    return limit;
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
