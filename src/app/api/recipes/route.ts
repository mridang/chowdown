/**
 * Recipe collection API for the signed-in user.
 *
 *   GET  /api/recipes        → list the `.cook` files in their Recipes folder
 *   POST /api/recipes        → create a new `.cook` file ({ name, content })
 *
 * Both resolve the user from the session and act on Drive with a token minted
 * from their stored refresh token, so the browser never handles Drive tokens.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { setRecipesFolderId } from '@/lib/db/users';
import {
  createRecipeFile,
  ensureRecipesFolder,
  listRecipeFiles,
} from '@/lib/drive/drive-client';
import { isUncurated, recipeDisplayName } from '@/lib/recipe/cook-text';
import { getDatabase } from '@/lib/util';

/** Resolve the user's Recipes folder id, creating/persisting it if needed. */
async function resolveFolderId(
  userId: number,
  folderIdFromDb: string | null,
  accessToken: string,
): Promise<string> {
  if (folderIdFromDb) {
    return folderIdFromDb;
  }
  const folderId = await ensureRecipesFolder(accessToken);
  await setRecipesFolderId(getDatabase(), userId, folderId);
  return folderId;
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const accessToken = await getUserAccessToken(user);
  const folderId = await resolveFolderId(
    user.id,
    user.recipes_folder_id,
    accessToken,
  );
  const files = await listRecipeFiles(folderId, accessToken);
  return NextResponse.json({
    recipes: files.map((f) => ({
      id: f.id,
      name: f.name,
      display: recipeDisplayName(f.name),
      uncurated: isUncurated(f.name),
      modifiedTime: f.modifiedTime ?? null,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    content?: string;
  } | null;
  if (!body?.name?.trim() || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'name and content required' }, { status: 400 });
  }
  const accessToken = await getUserAccessToken(user);
  const folderId = await resolveFolderId(
    user.id,
    user.recipes_folder_id,
    accessToken,
  );
  const created = await createRecipeFile(
    folderId,
    body.name.trim(),
    body.content,
    accessToken,
  );
  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      display: recipeDisplayName(created.name),
      uncurated: isUncurated(created.name),
    },
    { status: 201 },
  );
}
