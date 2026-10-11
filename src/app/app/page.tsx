import { redirect } from 'next/navigation';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { setRecipesFolderId } from '@/lib/db/users';
import { ensureRecipesFolder, listRecipeFiles } from '@/lib/drive/drive-client';
import { isUncurated, recipeDisplayName } from '@/lib/recipe/cook-text';
import { getDatabase } from '@/lib/util';

import { RecipeApp } from './_components/recipe-app';

/**
 * The authenticated app — a Server Component. It resolves the signed-in user,
 * loads their recipe list from Drive **on the server**, and hands it to the
 * interactive surface as initial data, so the list is present in the SSR HTML
 * (no client-fetch loading flash). Interactivity (search, create, open) stays
 * in the client island.
 */
export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  let initialRecipes: {
    id: string;
    name: string;
    display: string;
    uncurated: boolean;
    modifiedTime: string | null;
  }[] = [];

  try {
    const token = await getUserAccessToken(user);
    let folderId = user.recipes_folder_id;
    if (!folderId) {
      folderId = await ensureRecipesFolder(token);
      await setRecipesFolderId(getDatabase(), user.id, folderId);
    }
    const files = await listRecipeFiles(folderId, token);
    initialRecipes = files.map((f) => ({
      id: f.id,
      name: f.name,
      display: recipeDisplayName(f.name),
      uncurated: isUncurated(f.name),
      modifiedTime: f.modifiedTime ?? null,
    }));
  } catch {
    // Token expired or Drive unreachable — send them back through login so a
    // fresh refresh token is captured.
    redirect('/api/auth/login');
  }

  return (
    <RecipeApp
      userName={user.name ?? user.email}
      mcpToken={user.mcp_token}
      initialRecipes={initialRecipes}
    />
  );
}
