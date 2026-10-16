import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { RecipeGallery } from '@/components/recipe-gallery';
import { RecipeView } from '@/components/recipe-view';
import {
  getCurrentUser,
  getSessionUid,
  getUserAccessToken,
} from '@/lib/auth/current-user';
import { getRecipePageRows } from '@/lib/db/recipe-page';
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
import { parseSimilar, type SimilarRecipe } from '@/lib/recipe/similar';
import { indexRecipeWrite } from '@/lib/recipe/tag-index';
import { getDatabase } from '@/lib/util';

import { AddNote } from './_components/add-note';
import { HeartButton } from './_components/heart-button';
import { TagButton } from './_components/tag-button';

/** Canonical origin — mirrors `SITE_URL` in the root layout. */
const SITE_URL = 'https://chowdown.apps.mrida.ng';

/** What `loadRecipe` resolves to. */
interface RecipePageData {
  recipe: ParsedRecipe;
  notes: Note[];
  favourite: boolean;
  similar: SimilarRecipe[];
}

/**
 * Load one recipe for the page — **in a single D1 round trip**, with no Google
 * or Drive call. The user id comes from the signed session cookie (no `users`
 * lookup), and the recipe, favourite flag and precomputed similar list are
 * fetched together as one batch. D1 sits in one region, so each extra query
 * from the Worker costs a long round trip; collapsing three into one is what
 * keeps the page fast.
 *
 * Only a recipe that isn't in the cache yet (never seen by `/app` or the MCP)
 * falls back to Drive once, and is indexed so the next view is fast.
 *
 * Wrapped in React `cache()` so the page body and `generateMetadata` share one
 * result per request.
 */
const loadRecipe = cache(async (id: string): Promise<RecipePageData | null> => {
  const uid = await getSessionUid();
  if (uid === null) {
    redirect('/');
  }
  const db = getDatabase();

  let rows = await getRecipePageRows(db, uid, id);
  if (!rows.recipe) {
    // Cold cache: read from Drive once and index it, then re-read.
    try {
      const user = await getCurrentUser();
      if (!user) {
        redirect('/');
      }
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
      await indexRecipeWrite(
        db,
        user.id,
        id,
        file.name,
        source,
        file.modifiedTime ?? null,
      );
      rows = await getRecipePageRows(db, uid, id);
    } catch {
      return null;
    }
  }
  if (!rows.recipe) {
    return null;
  }

  return {
    recipe: parseRecipe(rows.recipe.source, rows.recipe.name),
    notes: extractNotes(rows.recipe.source),
    favourite: rows.favourite,
    similar: parseSimilar(rows.similarJson),
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

  const jsonLd = recipeToJsonLd(data.recipe, `${SITE_URL}/recipe/${id}`);
  const { favourite: favourited, similar } = data;

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
