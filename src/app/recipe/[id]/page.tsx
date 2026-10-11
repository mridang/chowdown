import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { RecipeGallery } from '@/components/recipe-gallery';
import { RecipeView } from '@/components/recipe-view';
import { getCurrentUser, getUserAccessToken } from '@/lib/auth/current-user';
import { listEmbeddings } from '@/lib/db/embeddings';
import { isFavourite } from '@/lib/db/favourites';
import { getRecipeByFileId } from '@/lib/db/recipes';
import { setRecipesFolderId } from '@/lib/db/users';
import {
  ensureRecipesFolder,
  getFileContent,
  listRecipeFiles,
} from '@/lib/drive/drive-client';
import { extractNotes, type Note } from '@/lib/recipe/cook-text';
import { parseRecipe, type ParsedRecipe } from '@/lib/recipe/cooklang';
import { extractMedia } from '@/lib/recipe/media';
import { recipeToJsonLd } from '@/lib/recipe/schema-org';
import { similarFromRows } from '@/lib/recipe/similar';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';
import { getDatabase } from '@/lib/util';

import { AddNote } from './_components/add-note';
import { HeartButton } from './_components/heart-button';
import { TagButton } from './_components/tag-button';

/** Canonical origin — mirrors `SITE_URL` in the root layout. */
const SITE_URL = 'https://chowdown.apps.mrida.ng';

/** How many "find similar" recipes to surface under the method. */
const SIMILAR_COUNT = 6;

/** What `loadRecipe` resolves to. */
interface RecipePageData {
  userId: number;
  recipe: ParsedRecipe;
  notes: Note[];
}

/**
 * Load one recipe by its Drive id — **from the D1 cache first**, so a recipe
 * click is a single indexed read with no Google token refresh and no Drive
 * round-trip (that was the source of the multi-second loads). Only a cold cache
 * (a recipe never seen by `/app` or the MCP) falls back to Drive once, and
 * populates the cache so the next load is instant.
 *
 * Wrapped in React `cache()` so the page body and `generateMetadata` share one
 * result per request instead of loading the recipe twice.
 */
const loadRecipe = cache(async (id: string): Promise<RecipePageData | null> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }
  const db = getDatabase();

  let row = await getRecipeByFileId(db, user.id, id);
  if (!row) {
    // Cold cache: read from Drive once and index it, then re-read.
    try {
      const token = await getUserAccessToken(user);
      const folderId =
        user.recipes_folder_id ?? (await ensureRecipesFolder(token));
      if (!user.recipes_folder_id) {
        await setRecipesFolderId(db, user.id, folderId);
      }
      const files = await listRecipeFiles(folderId, token);
      const file = files.find((f) => f.id === id);
      if (!file) {
        return null;
      }
      const source = await getFileContent(file.id, token);
      await indexRecipeWrite(db, user.id, id, file.name, source, file.modifiedTime ?? null);
      row = await getRecipeByFileId(db, user.id, id);
    } catch {
      return null;
    }
  }
  if (!row) {
    return null;
  }

  return {
    userId: user.id,
    recipe: parseRecipe(row.source, row.name),
    notes: extractNotes(row.source),
  };
});

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
    // Fall through to the default title on any hiccup.
  }
  return { title: 'Recipe · chowdown' };
}

/**
 * The server-rendered recipe page. Content, schema.org JSON-LD and the
 * "find similar" row are all resolved from D1 (the embeddings cache powers
 * similarity with no model call), so the page renders in a single fast pass.
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

  const db = getDatabase();
  const jsonLd = recipeToJsonLd(data.recipe, `${SITE_URL}/recipe/${id}`);
  const [embeddings, favourited] = await Promise.all([
    listEmbeddings(db, data.userId),
    isFavourite(db, data.userId, id),
  ]);
  const similar = similarFromRows(embeddings, id, SIMILAR_COUNT);

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

      <RecipeGallery media={extractMedia(data.recipe)} />

      <RecipeView recipe={data.recipe} notes={data.notes} />

      <div className="mt-6">
        <AddNote
          recipeId={id}
          ingredients={data.recipe.ingredients.map((i) => i.name)}
        />
      </div>

      {similar.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Find similar
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/recipe/${s.id}`}
                  className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
