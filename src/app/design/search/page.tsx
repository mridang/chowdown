import Link from 'next/link';

import { loadRecipes } from '@/design/data';
import { FilterDrawer } from '@/design/filter-drawer';
import { FilterPanel } from '@/design/filter-panel';
import { HeartIcon } from '@/design/icons';
import { RecipeCard, RecipeGrid } from '@/design/recipe-card';
import {
  activeFilters,
  buildFacets,
  hrefFor,
  matches,
  parseQuery,
  SORTS,
  sortRecipes,
  type RawParams,
} from '@/design/search-query';
import { DesignShell } from '@/design/shell';
import { SortSelect } from '@/design/sort-select';
import { ButtonLink } from '@/design/ui/button';
import { FilterChip } from '@/design/ui/chip';
import { SearchField } from '@/design/ui/field';
import { Container, Eyebrow, Heading } from '@/design/ui/layout';
import { cn } from '@/design/ui/cn';
import { countOf } from '@/lib/intl';

/** Search screen: collapsible filters beside the grid on desktop, a drawer on phones. */
export default async function DesignSearch({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const query = parseQuery(await searchParams);
  const recipes = loadRecipes();
  const facets = buildFacets(recipes, query);
  const found = sortRecipes(
    recipes.filter((r) => matches(r, query)),
    query.sort,
  );
  const shown = found.slice(0, query.limit);
  const chips = activeFilters(query);
  const favouriteCount = recipes.filter((r) => r.favourite).length;

  const favouritesLink = (
    <Link
      href={hrefFor({ ...query, favourites: !query.favourites })}
      scroll={false}
      aria-pressed={query.favourites}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-control px-3.5 text-sm font-semibold transition',
        query.favourites
          ? 'bg-ink text-white'
          : 'bg-marigold hover:bg-marigold/85',
      )}
    >
      <span className="flex items-center gap-2">
        <HeartIcon filled={query.favourites} className="h-4 w-4" />
        Favourites
      </span>
      <span className="tabular-nums">{favouriteCount}</span>
    </Link>
  );

  return (
    <DesignShell signedIn active="search">
      <div className="border-ink/10 border-b">
        <Container className="py-8 sm:py-12">
          <Eyebrow>Your collection</Eyebrow>
          <Heading as="h1" variant="h1" className="mt-2">
            Recipes
          </Heading>
          <form action="/design/search" className="mt-6 max-w-2xl">
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
              placeholder="Search by name, ingredient or site…"
              aria-label="Search recipes"
              action={
                <button
                  type="submit"
                  className="rounded-control bg-ink hover:bg-ink/85 h-10 px-5 text-sm font-semibold text-white transition"
                >
                  Search
                </button>
              }
            />
          </form>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10 md:py-10 lg:gap-12">
        <aside className="hidden md:sticky md:top-24 md:block md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:pr-1">
          <div className="mb-4">{favouritesLink}</div>
          <FilterPanel facets={facets} />
        </aside>

        <FilterDrawer activeCount={chips.length}>
          <div className="mb-4">{favouritesLink}</div>
          <FilterPanel facets={facets} />
        </FilterDrawer>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-ink/65 text-sm">
                {countOf(found.length, 'recipe')}
              </p>
              {chips.map((chip) => (
                <FilterChip key={chip.label} href={chip.href}>
                  {chip.label}
                </FilterChip>
              ))}
              {chips.length > 0 || query.q ? (
                <Link
                  href="/design/search"
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
              {shown.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </RecipeGrid>
          ) : (
            <div className="rounded-card border-ink/25 border border-dashed px-6 py-16 text-center">
              <Heading variant="h3">Nothing matches those filters</Heading>
              <p className="text-ink/70 mt-2">
                Try removing one, or start over.
              </p>
              <div className="mt-6 flex justify-center">
                <ButtonLink href="/design/search" variant="outline">
                  Clear all filters
                </ButtonLink>
              </div>
            </div>
          )}

          {found.length > shown.length ? (
            <div className="mt-10 flex justify-center">
              <ButtonLink
                href={`${hrefFor(query)}${hrefFor(query).includes('?') ? '&' : '?'}limit=${query.limit + 24}`}
                variant="outline"
                size="lg"
              >
                Show more ({found.length - shown.length} left)
              </ButtonLink>
            </div>
          ) : null}
        </section>
      </Container>
    </DesignShell>
  );
}
