import { redirect } from 'next/navigation';

import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { listRecipesByUser } from '@/lib/db/recipes';
import { setRecipesFolderId } from '@/lib/db/users';
import { ensureRecipesFolder, listRecipeFiles } from '@/lib/drive/drive-client';
import { isUncurated, recipeDisplayName } from '@/lib/recipe/cook-text';
import { parseRecipe } from '@/lib/recipe/cooklang';
import {
  buildFacetView,
  facetCounts,
  matchesFilters,
  parseFilters,
  type SearchParams,
} from '@/lib/recipe/facet-filter';
import { extractMedia } from '@/lib/recipe/media';
import { syncRecipeTags, type RecipeTags } from '@/lib/recipe/tag-index';
import { getDatabase } from '@/lib/util';

import { RecipeApp, type RecipeCard } from './_components/recipe-app';

/** The recipe facets we surface as small chips on each grid card. */
const CARD_FACETS = ['cuisine', 'protein', 'difficulty'] as const;

/**
 * The authenticated app — a Server Component. It lists the user's recipes from
 * Drive, keeps the D1 tag index fresh, and renders a **filtered grid** on the
 * server from the URL query string (search, facets, view mode). Each card
 * carries its cover image and a couple of tag chips. The interactive shell
 * (facet controls, view toggle) is a client island.
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

  let items: (RecipeCard & { tags: RecipeTags })[] = [];

  try {
    const token = await getUserAccessToken(user);
    let folderId = user.recipes_folder_id;
    if (!folderId) {
      folderId = await ensureRecipesFolder(token);
      await setRecipesFolderId(getDatabase(), user.id, folderId);
    }
    const files = await listRecipeFiles(folderId, token);
    // Keep the D1 cache (source + tags) fresh, then read cover + tags from it.
    await syncRecipeTags(user, files, token);
    const rows = await listRecipesByUser(getDatabase(), user.id);
    const rowById = new Map(rows.map((r) => [r.drive_file_id, r]));
    items = files.map((f) => {
      const row = rowById.get(f.id);
      const parsed = row ? parseRecipe(row.source, row.name) : null;
      return {
        id: f.id,
        display: recipeDisplayName(f.name),
        uncurated: isUncurated(f.name),
        cover: parsed ? extractMedia(parsed).cover : undefined,
        tags: row?.tags ? (JSON.parse(row.tags) as RecipeTags) : {},
      };
    });
  } catch {
    // Token expired or Drive unreachable — re-auth to capture a fresh token.
    redirect('/api/auth/login');
  }

  const filters = parseFilters(await searchParams);
  const facets = buildFacetView(facetCounts(items), filters);
  const filtered = items.filter((it) => matchesFilters(it, filters));

  const sp = await searchParams;
  const view = sp['view'] === 'list' ? 'list' : 'grid';

  return (
    <RecipeApp
      userName={user.name ?? user.email}
      mcpToken={user.mcp_token}
      recipes={filtered.map((it) => ({
        id: it.id,
        display: it.display,
        uncurated: it.uncurated,
        cover: it.cover,
        chips: CARD_FACETS.flatMap((k) => it.tags[k] ?? []).slice(0, 3),
      }))}
      facets={facets}
      total={items.length}
      view={view}
    />
  );
}
