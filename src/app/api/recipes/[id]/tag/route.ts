/**
 * Auto-tag a single recipe.
 *
 *   POST /api/recipes/:id/tag → { tagged: boolean, tags: [key, value][] }
 *
 * Classifies the recipe against the curated taxonomy with Workers AI, writes
 * the validated tags into the `.cook` file as `>> key: value` metadata, and
 * saves it back to Drive. Nothing is written when the model can't confidently
 * tag it, so a tag pass can never corrupt a recipe.
 */

import { NextResponse } from 'next/server';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { tagCookSource } from '@/lib/recipe/tagging';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';
import { getFileContent, updateRecipeFile } from '@/lib/drive/drive-client';
import { getDatabase, getEnv } from '@/lib/util';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const accessToken = await getUserAccessToken(user);
  try {
    const original = await getFileContent(id, accessToken);
    const { source, tags } = await tagCookSource(original, 'recipe.cook', getEnv());
    if (tags.length === 0) {
      return NextResponse.json({ tagged: false, tags: [] });
    }
    await updateRecipeFile(id, source, accessToken);
    const db = getDatabase();
    const row = await getRecipeByFileId(db, user.id, id);
    if (row) {
      await indexRecipeWrite(db, user.id, id, row.name, source);
    }
    return NextResponse.json({ tagged: true, tags });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
