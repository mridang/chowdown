'use client';

import Link from 'next/link';

import { CoverImage } from '@/components/cover-image';
import { countOf } from '@/lib/intl';
import { FavouriteButton } from '@/components/favourite-button';
import type { FacetView } from '@/lib/recipe/facet-filter';

import { ConnectPanel } from './connect-panel';
import { FilterControls } from './filter-controls';
import { SignOutButton } from './sign-out-button';
import { ViewToggle } from './view-toggle';

/** A recipe as shown on a grid/list card. */
export interface RecipeCard {
  id: string;
  display: string;
  uncurated: boolean;
  /** Cover image URL, if the recipe has one. */
  cover?: string;
  /** A few tag chips (cuisine/protein/difficulty) for the card. */
  chips?: string[];
  /** Whether the user has hearted it. */
  favourite: boolean;
}

/** A neutral cover placeholder (first letter) when a recipe has no image. */
function CoverFallback({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <div
      className={`grid place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 ${className}`}
      aria-hidden="true"
    >
      <span className="text-2xl font-semibold">
        {name.trim().charAt(0).toUpperCase() || '🍳'}
      </span>
    </div>
  );
}

/** One recipe as a grid card: cover on top, name + chips below. */
function GridCard({ recipe }: { recipe: RecipeCard }) {
  return (
    // The heart is a sibling of the link (not inside it), laid over the cover;
    // `group` on the wrapper lets it appear when the card is hovered.
    <div className="group relative flex">
      <Link
        href={`/recipe/${recipe.id}`}
        prefetch
        className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
      >
        {recipe.cover ? (
          <CoverImage
            src={recipe.cover}
            className="h-40 w-full object-cover"
            fallback={
              <CoverFallback name={recipe.display} className="h-40 w-full" />
            }
          />
        ) : (
          <CoverFallback name={recipe.display} className="h-40 w-full" />
        )}
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-sm font-semibold text-slate-800 group-hover:text-slate-900">
              {recipe.display}
            </h3>
            {recipe.uncurated ? (
              <span className="flex-none rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                idea
              </span>
            ) : null}
          </div>
          {recipe.chips && recipe.chips.length > 0 ? (
            <div className="mt-auto flex flex-wrap gap-1">
              {recipe.chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 capitalize"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
      <FavouriteButton
        recipeId={recipe.id}
        initial={recipe.favourite}
        variant="overlay"
        className="absolute top-2 right-2"
      />
    </div>
  );
}

/** One recipe as a list row: thumbnail + name + chips. */
function ListRow({ recipe }: { recipe: RecipeCard }) {
  return (
    <div className="group relative flex">
      <Link
        href={`/recipe/${recipe.id}`}
        prefetch
        className="flex flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 pr-12 transition hover:border-slate-300 hover:bg-slate-50"
      >
        {recipe.cover ? (
          <CoverImage
            src={recipe.cover}
            className="h-12 w-12 flex-none rounded-md object-cover"
            fallback={
              <CoverFallback
                name={recipe.display}
                className="h-12 w-12 flex-none rounded-md"
              />
            }
          />
        ) : (
          <CoverFallback
            name={recipe.display}
            className="h-12 w-12 flex-none rounded-md"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
          {recipe.display}
        </span>
        {recipe.chips && recipe.chips.length > 0 ? (
          <span className="hidden gap-1 sm:flex">
            {recipe.chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 capitalize"
              >
                {c}
              </span>
            ))}
          </span>
        ) : null}
        {recipe.uncurated ? (
          <span className="flex-none rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
            idea
          </span>
        ) : null}
      </Link>
      <FavouriteButton
        recipeId={recipe.id}
        initial={recipe.favourite}
        variant="inline"
        className="absolute top-1/2 right-2 -translate-y-1/2"
      />
    </div>
  );
}

/**
 * The authenticated app shell. Filtering and the view mode come from the URL
 * (server-rendered), so this renders the already-filtered recipes as a grid or
 * list of cards with cover images, plus the facet sidebar. Adding recipes is a
 * separate page (`/recipes/add`); this is purely browse + filter.
 */
export function RecipeApp({
  userName,
  mcpToken,
  recipes,
  facets,
  total,
  favouriteIds,
  view,
}: {
  userName: string;
  mcpToken: string;
  recipes: RecipeCard[];
  facets: FacetView[];
  total: number;
  /** Ids of hearted recipes (for the Favourites filter's live badge). */
  favouriteIds: string[];
  view: 'grid' | 'list';
}) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            🍳 chowdown
          </span>
          <span className="text-sm text-slate-400">· {userName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/recipes/add"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Add recipes
          </Link>
          <SignOutButton />
        </div>
      </header>

      <ConnectPanel mcpToken={mcpToken} />

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[16rem_1fr]">
        <aside>
          <FilterControls facets={facets} favouriteIds={favouriteIds} />
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {recipes.length === total
                ? countOf(total, 'recipe')
                : `${recipes.length} of ${countOf(total, 'recipe')}`}
            </p>
            <ViewToggle view={view} />
          </div>

          {recipes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
              {total === 0 ? (
                <>
                  No recipes yet —{' '}
                  <Link
                    href="/recipes/add"
                    className="font-medium text-amber-700"
                  >
                    add your first one
                  </Link>
                  .
                </>
              ) : (
                'No recipes match these filters.'
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {recipes.map((r) => (
                <GridCard key={r.id} recipe={r} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recipes.map((r) => (
                <ListRow key={r.id} recipe={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
