/**
 * Natural-language recipe suggestions — the app's "what do you feel like?" box.
 *
 *   POST /api/suggest  { query: string } → { results: { id, title }[] }
 *
 * Embeds the free-text query with Workers AI and ranks the user's recipes by
 * cosine similarity against the (lazily maintained) embedding cache — the same
 * semantic search the `find_recipes` MCP tool exposes, surfaced in the app.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { setRecipesFolderId } from '@/lib/db/users';
import { ensureRecipesFolder, listRecipeFiles } from '@/lib/drive/drive-client';
import { recipeDisplayName } from '@/lib/recipe/cook-text';
import { embedText } from '@/lib/recipe/embeddings';
import { ensureEmbeddings, topSimilar } from '@/lib/recipe/similar';
import { getDatabase, getEnv } from '@/lib/util';

/** How many suggestions to return. */
const LIMIT = 8;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    query?: string;
  } | null;
  const query = body?.query?.trim();
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const token = await getUserAccessToken(user);
  let folderId = user.recipes_folder_id;
  if (!folderId) {
    folderId = await ensureRecipesFolder(token);
    await setRecipesFolderId(getDatabase(), user.id, folderId);
  }

  const files = await listRecipeFiles(folderId, token);
  const rows = await ensureEmbeddings(user, files, token);
  const queryVector = await embedText(getEnv(), query);
  const matched = topSimilar(rows, queryVector, files, LIMIT);

  return NextResponse.json({
    results: matched.map((f) => ({
      id: f.id,
      title: recipeDisplayName(f.name),
    })),
  });
}
