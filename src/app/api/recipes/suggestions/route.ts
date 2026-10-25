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
 *
 * The behaviour lives in the `suggestionsCollection` controller; the exported
 * handler only mounts it.
 */

import { requireUser } from '@/domain/api/auth';
import { driveFailure } from '@/domain/api/drive-failure';
import { ApiController, page, parseLimit, problems } from '@/lib/core/api';
import { budgetRefusal } from '@/domain/api/daily-budget';
import { getUserAccessToken } from '@/domain/auth/user-access-token';
import { listRecipeFiles } from '@/domain/drive/recipe-files';
import { recipesFolderFor } from '@/domain/drive/recipes-folder';
import { recipeDisplayName } from '@/lib/cooklang';
import { embedText } from '@/domain/recipe/embeddings';
import { ensureEmbeddings, topSimilar } from '@/domain/recipe/similar';
import { getEnv } from '@/lib/core/runtime';
import type { User } from '@/domain/db/users';
import { DAILY_BUDGETS } from '@/domain/daily-budget';

export const dynamic = 'force-dynamic';

/** How many suggestions to give when the client does not say. */
const DEFAULT_SUGGESTIONS = 8;

/**
 * The longest wish accepted, in characters. It goes straight to the embedding
 * model; a sentence or two is all a wish ever needs.
 */
const MAX_QUERY_LENGTH = 300;

/** The signed-in caller and the request. */
interface UserContext {
  readonly request: Request;
  readonly user: Readonly<User>;
}

/**
 * The suggestions controller.
 *
 * `GET /api/recipes/suggestions?q=…&limit=…`: the user's recipes closest in
 * meaning to the text in `q`, best first, as `{ id, title }` entries. Answers
 * 200 with a page, 400 for a missing or over-long (300 characters) `q` or a bad
 * `limit`. Needs a signed-in user: 401, and 502 or 409 when Drive or the model
 * is unavailable.
 */
const suggestionsCollection = new ApiController<UserContext>({
  context: async (request) => {
    const auth = await requireUser(request);
    if (!auth.ok) {
      throw auth.response;
    }
    return { request, user: auth.value };
  },
}).on({
  method: 'GET',
  handle: async (_input, { request, user }) => {
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
    const spent = await budgetRefusal(DAILY_BUDGETS.suggest, user.id, 'search');
    if (spent) {
      return spent;
    }

    try {
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
      return page(
        matched.map((f) => ({ id: f.id, title: recipeDisplayName(f.name) })),
        undefined,
        { 'Cache-Control': 'private, no-cache' },
      );
    } catch (error) {
      return driveFailure(error, 'Suggestions are unavailable right now.');
    }
  },
  encode: (result) => result,
});

export const { GET } = suggestionsCollection.handlers();
