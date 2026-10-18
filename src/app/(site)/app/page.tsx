import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyCollection } from '@/components/recipes/empty-collection';
import {
  DriveConnectNotice,
  DriveConnectPanel,
  DriveUnreachable,
} from '@/components/site/drive-connect';
import { FavouritesLink } from '@/components/recipes/favourites-link';
import { FilterDrawer } from '@/components/recipes/filter-drawer';
import { FilterPanel } from '@/components/recipes/filter-panel';
import { RecipeCard, RecipeGrid } from '@/components/recipes/recipe-card';
import {
  activeFilters,
  buildFacets,
  hrefFor,
  matches,
  moreHref,
  parseQuery,
  SORTS,
  sortRecipes,
  type RawParams,
} from '@/components/recipes/search-query';
import { SortSelect } from '@/components/recipes/sort-select';
import { buttonClass, ButtonLink } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/chip';
import { SearchField } from '@/components/ui/field';
import { PlusIcon } from '@/components/icons';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { driveAttemptOf } from '@/lib/auth/drive-access';
import { countOf } from '@/lib/intl';
import { toCardRecipe } from '@/lib/recipe/card-data';
import { loadCollection } from '@/lib/recipe/load-collection';

/** How many cards are likely on screen at first, and so load their photos eagerly. */
const ABOVE_THE_FOLD = 3;

export const metadata: Metadata = {
  title: 'Your recipes · chowdown',
  description:
    'Search, filter and sort every recipe in your own Google Drive collection.',
};

/**
 * The recipe list — a Server Component. It reads the user's cached recipes
 * (keeping the cache fresh from Drive behind the scenes), then filters, sorts
 * and pages them on the server from the URL's query string, so every filter,
 * sort and "Show more" is a plain link. Collapsible filters sit beside the grid
 * on desktop and open from a button in a drawer on phones.
 */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const { recipes: rows, favouriteIds, drive } = await loadCollection();
  const params = await searchParams;
  // `?drive=denied|error` is where a failed attempt to connect Drive lands.
  const attempt = driveAttemptOf(params['drive']);
  const hearted = new Set(favouriteIds);
  const recipes = rows.map((row) =>
    toCardRecipe(row, hearted.has(row.drive_file_id)),
  );

  const query = parseQuery(params);
  const facets = buildFacets(recipes, query);
  const found = sortRecipes(
    recipes.filter((r) => matches(r, query)),
    query.sort,
  );
  const shown = found.slice(0, query.limit);
  const chips = activeFilters(query);
  // Counted from the recipes that still exist, in case a favourite outlived its file.
  const serverFavourites = recipes.filter((r) => r.favourite).map((r) => r.id);

  const favouritesLink = (
    <FavouritesLink
      href={hrefFor({ ...query, favourites: !query.favourites })}
      active={query.favourites}
      serverIds={serverFavourites}
    />
  );

  return (
    <>
      <div className="border-ink/10 border-b">
        <Container className="py-8 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <Eyebrow>Your collection</Eyebrow>
              <Heading as="h1" variant="h1" className="mt-2">
                Recipes
              </Heading>
            </div>
            <ButtonLink href="/recipes/add" size="lg">
              <PlusIcon className="h-5 w-5" />
              Add recipe
            </ButtonLink>
          </div>
          <form action="/app" role="search" className="mt-6 max-w-2xl">
            {/* Searching keeps the filters and order already chosen. */}
            {query.favourites ? (
              <input type="hidden" name="fav" value="1" />
            ) : null}
            {query.sort !== 'title' ? (
              <input type="hidden" name="sort" value={query.sort} />
            ) : null}
            {Object.entries(query.selected).map(([key, values]) =>
              values?.length ? (
                <input
                  key={key}
                  type="hidden"
                  name={key}
                  value={values.join(',')}
                />
              ) : null,
            )}
            <SearchField
              size="lg"
              name="q"
              defaultValue={query.q}
              placeholder="Search recipes, sites or tags"
              aria-label="Search recipes"
              action={
                <button
                  type="submit"
                  className="rounded-control bg-ink hover:bg-ink/85 focus-visible:outline-ink h-10 px-5 text-sm font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Search
                </button>
              }
            />
          </form>
        </Container>
      </div>

      {recipes.length === 0 ? (
        <Container className="py-10">
          {drive.unreachable ? (
            <DriveUnreachable />
          ) : drive.connected ? (
            <EmptyCollection />
          ) : (
            <DriveConnectPanel reconnect={drive.reconnect} attempt={attempt} />
          )}
        </Container>
      ) : (
        <>
          {drive.connected ? null : (
            <Container className="pt-8">
              <DriveConnectNotice
                reconnect={drive.reconnect}
                attempt={attempt}
              />
            </Container>
          )}
          <Container className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10 md:py-10 lg:gap-12">
            <aside
              aria-label="Filters"
              className="hidden md:sticky md:top-24 md:block md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:pr-1"
            >
              <div className="mb-4">{favouritesLink}</div>
              <FilterPanel facets={facets} />
            </aside>

            <FilterDrawer activeCount={chips.length}>
              <div className="mb-4">{favouritesLink}</div>
              <FilterPanel facets={facets} />
            </FilterDrawer>

            <section aria-label="Results" className="min-w-0">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-ink/65 text-sm" aria-live="polite">
                    {countOf(found.length, 'recipe')}
                  </p>
                  {chips.map((chip) => (
                    <FilterChip key={chip.href} href={chip.href}>
                      {chip.label}
                    </FilterChip>
                  ))}
                  {chips.length > 0 || query.q ? (
                    <Link
                      href="/app"
                      className="inline-flex h-8 items-center px-1 text-sm font-medium underline underline-offset-4"
                    >
                      Clear all
                    </Link>
                  ) : null}
                </div>
                <SortSelect
                  value={query.sort}
                  options={SORTS.map(([value, label]) => ({
                    value,
                    label,
                    href: hrefFor({ ...query, sort: value }),
                  }))}
                />
              </div>

              {shown.length > 0 ? (
                <RecipeGrid>
                  {shown.map((recipe, i) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      live
                      headingLevel="h2"
                      priority={i < ABOVE_THE_FOLD}
                    />
                  ))}
                </RecipeGrid>
              ) : (
                <div className="rounded-card border-ink/25 border border-dashed px-6 py-16 text-center">
                  <Heading variant="h3">Nothing matches those filters</Heading>
                  <p className="text-ink/70 mt-2">
                    Try removing one, or start over.
                  </p>
                  <div className="mt-6 flex justify-center">
                    <ButtonLink href="/app" variant="outline">
                      Clear all filters
                    </ButtonLink>
                  </div>
                </div>
              )}

              {found.length > shown.length ? (
                <div className="mt-10 flex justify-center">
                  <Link
                    href={moreHref(query)}
                    scroll={false}
                    className={buttonClass({ variant: 'outline', size: 'lg' })}
                  >
                    Show more ({found.length - shown.length} left)
                  </Link>
                </div>
              ) : null}
            </section>
          </Container>
        </>
      )}
    </>
  );
}
