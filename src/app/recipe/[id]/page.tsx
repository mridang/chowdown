import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { RecipeView } from '@/components/recipe-view';
import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { isFavourite } from '@/lib/db/favourites';
import { setRecipesFolderId } from '@/lib/db/users';
import {
  ensureRecipesFolder,
  getFileContent,
  listRecipeFiles,
  type DriveFile,
} from '@/lib/drive/drive-client';
import { recipeDisplayName } from '@/lib/recipe/cook-text';
import { parseRecipe, type ParsedRecipe } from '@/lib/recipe/cooklang';
import { recipeToJsonLd } from '@/lib/recipe/schema-org';
import { ensureEmbeddings, topSimilar } from '@/lib/recipe/similar';
import { getDatabase } from '@/lib/util';

import { HeartButton } from './_components/heart-button';
import { TagButton } from './_components/tag-button';

/** Canonical origin — mirrors `SITE_URL` in the root layout. */
const SITE_URL = 'https://chowdown.apps.mrida.ng';

/** How many "find similar" recipes to surface under the method. */
const SIMILAR_COUNT = 6;

/**
 * Resolve the signed-in user and the Drive folder id, loading the user through
 * login again if the stored token can no longer be refreshed. Returns the
 * access token and folder id both the recipe fetch and the similarity pass
 * need, so neither has to re-derive them.
 */
async function requireDriveContext(): Promise<{
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  token: string;
  folderId: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }
  const token = await getUserAccessToken(user);
  let folderId = user.recipes_folder_id;
  if (!folderId) {
    folderId = await ensureRecipesFolder(token);
    await setRecipesFolderId(getDatabase(), user.id, folderId);
  }
  return { user, token, folderId };
}

/** What `loadRecipe` resolves to: the parsed recipe plus its sibling files. */
interface RecipePageData {
  file: DriveFile;
  recipe: ParsedRecipe;
  files: DriveFile[];
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  token: string;
}

/**
 * Load one recipe by its Drive id for the given page, returning `null` when it
 * isn't in the user's folder (so the caller can render a 404). Also hands back
 * the full file list so the similarity pass doesn't re-list Drive.
 */
async function loadRecipe(id: string): Promise<RecipePageData | null> {
  const { user, token, folderId } = await requireDriveContext();
  const files = await listRecipeFiles(folderId, token);
  const file = files.find((f) => f.id === id);
  if (!file) {
    return null;
  }
  const source = await getFileContent(file.id, token);
  return { file, recipe: parseRecipe(source, file.name), files, user: user!, token };
}

/** Compute the "find similar" row for a recipe, server-side. */
async function similarRecipes(data: RecipePageData): Promise<DriveFile[]> {
  const rows = await ensureEmbeddings(data.user, data.files, data.token);
  const self = rows.find((r) => r.drive_file_id === data.file.id);
  if (!self) {
    return [];
  }
  return topSimilar(
    rows,
    JSON.parse(self.vector) as number[],
    data.files,
    SIMILAR_COUNT,
    data.file.id,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await loadRecipe(id);
    if (data) {
      return { title: `${data.recipe.title} · chowdown` };
    }
  } catch {
    // Fall through to the default title on any Drive/auth hiccup.
  }
  return { title: 'Recipe · chowdown' };
}

/**
 * The server-rendered recipe page. Everything here is resolved on the server —
 * the recipe content, the schema.org JSON-LD, and the "find similar" row — so
 * the page is a complete, shareable, structured-data document with no client
 * fetch. Interactivity (hearts, annotations) will be added as client islands
 * layered on top of this SSR shell.
 */
export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadRecipe(id);
  if (!data) {
    notFound();
  }

  const jsonLd = recipeToJsonLd(data.recipe, `${SITE_URL}/recipe/${id}`);
  const similar = await similarRecipes(data);
  const favourited = await isFavourite(getDatabase(), data.user.id, id);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Structured data for search engines and recipe scrapers. */}
      <script
        type="application/ld+json"
        // JSON.stringify output is safe to inline; no user-controlled markup.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="flex items-center justify-between text-sm">
        <Link
          href="/app"
          className="text-slate-500 transition hover:text-slate-900"
        >
          ← All recipes
        </Link>
        <div className="flex items-center gap-2">
          <TagButton recipeId={id} />
          <HeartButton recipeId={id} initial={favourited} />
        </div>
      </nav>

      <RecipeView recipe={data.recipe} />

      {similar.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Find similar
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/recipe/${f.id}`}
                  className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {recipeDisplayName(f.name)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
