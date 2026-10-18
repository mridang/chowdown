import { FACETS, RECIPES, SOURCES } from '@/design/fixtures';
import { RecipeCard, RecipeGrid } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';
import { Button } from '@/design/ui/button';
import { CountBadge, FilterChip } from '@/design/ui/chip';
import { SearchField, SelectField } from '@/design/ui/field';
import { FacetGroup } from '@/design/ui/facet';
import { Container, Eyebrow, Heading } from '@/design/ui/layout';

/** Every filter group; used in the desktop sidebar and the phone drawer. */
function Filters() {
  return (
    <div className="flex flex-col gap-5">
      {FACETS.map((facet) => (
        <FacetGroup
          key={facet.label}
          title={facet.label}
          values={facet.values}
          checked={facet.label === 'Cuisine' ? ['Mexican'] : []}
        />
      ))}
      <FacetGroup title="Source" values={SOURCES} />
    </div>
  );
}

/** The Favourites shortcut above the filters. */
function FavouritesToggle() {
  return (
    <button
      type="button"
      className="rounded-control bg-marigold hover:bg-marigold/85 flex h-10 w-full items-center justify-between px-3.5 text-sm font-semibold transition"
    >
      Favourites
      <span className="tabular-nums">5</span>
    </button>
  );
}

/** Search screen: filters beside the grid on desktop, behind a button on phones. */
export default function DesignSearch() {
  return (
    <DesignShell signedIn active="search">
      <div className="border-ink/10 border-b">
        <Container className="py-8 sm:py-12">
          <Eyebrow>Your collection</Eyebrow>
          <Heading as="h1" variant="h1" className="mt-2">
            Recipes
          </Heading>
          <SearchField
            size="lg"
            placeholder="Search by name, tag or site…"
            aria-label="Search recipes"
            className="mt-6 max-w-2xl"
          />
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-8 py-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 md:py-10 lg:gap-12">
        <aside className="hidden md:sticky md:top-24 md:block md:self-start">
          <div className="mb-6">
            <FavouritesToggle />
          </div>
          <Filters />
        </aside>

        <details className="rounded-card border-ink/15 border bg-white md:hidden">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
            Filters
            <CountBadge>1</CountBadge>
          </summary>
          <div className="border-ink/10 flex flex-col gap-5 border-t p-4">
            <FavouritesToggle />
            <Filters />
          </div>
        </details>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-ink/65 text-sm">85 recipes</p>
              <FilterChip>Mexican</FilterChip>
              <button
                type="button"
                className="text-sm font-medium underline underline-offset-4"
              >
                Clear all
              </button>
            </div>
            <SelectField label="Sort" defaultValue="title">
              <option value="title">Title A–Z</option>
              <option value="recent">Recently changed</option>
            </SelectField>
          </div>

          <RecipeGrid>
            {RECIPES.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </RecipeGrid>

          <div className="mt-10 flex justify-center">
            <Button variant="outline" size="lg">
              Load more
            </Button>
          </div>
        </section>
      </Container>
    </DesignShell>
  );
}
