import { redirect } from 'next/navigation';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { setRecipesFolderId } from '@/lib/db/users';
import { ensureRecipesFolder, listRecipeFiles } from '@/lib/drive/drive-client';
import { isUncurated, recipeDisplayName } from '@/lib/recipe/cook-text';
import {
  buildFacetView,
  facetCounts,
  matchesFilters,
  parseFilters,
  type SearchParams,
} from '@/lib/recipe/facet-filter';
import { syncRecipeTags, type RecipeTags } from '@/lib/recipe/tag-index';
import { getDatabase } from '@/lib/util';

import { RecipeApp } from './_components/recipe-app';

/**
 * The authenticated app — a Server Component. It resolves the signed-in user,
 * lists their recipes from Drive, keeps the tag index fresh, and filters the
 * list **on the server** from the URL query string (search + facets), so the
 * filtered view is in the SSR HTML and is shareable. The interactive shell
 * (create, import, the facet controls that navigate) is a client island.
 */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }

  let items: {
    id: string;
    name: string;
    display: string;
    uncurated: boolean;
    modifiedTime: string | null;
    tags: RecipeTags;
  }[] = [];

  try {
    const token = await getUserAccessToken(user);
    let folderId = user.recipes_folder_id;
    if (!folderId) {
      folderId = await ensureRecipesFolder(token);
      await setRecipesFolderId(getDatabase(), user.id, folderId);
    }
    const files = await listRecipeFiles(folderId, token);
    const tagsById = await syncRecipeTags(user, files, token);
    items = files.map((f) => ({
      id: f.id,
      name: f.name,
      display: recipeDisplayName(f.name),
      uncurated: isUncurated(f.name),
      modifiedTime: f.modifiedTime ?? null,
      tags: tagsById.get(f.id) ?? {},
    }));
  } catch {
    // Token expired or Drive unreachable — send them back through login so a
    // fresh refresh token is captured.
    redirect('/api/auth/login');
  }

  const filters = parseFilters(await searchParams);
  const facets = buildFacetView(facetCounts(items), filters);
  const filtered = items.filter((it) => matchesFilters(it, filters));

  return (
    <RecipeApp
      userName={user.name ?? user.email}
      mcpToken={user.mcp_token}
      recipes={filtered.map(({ id, name, display, uncurated, modifiedTime }) => ({
        id,
        name,
        display,
        uncurated,
        modifiedTime,
      }))}
      facets={facets}
      total={items.length}
    />
  );
}
