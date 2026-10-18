import Link from 'next/link';

import { ArrowIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { ConnectBand } from '@/components/site/connect-band';
import {
  DriveConnectNotice,
  DriveConnectPanel,
  DriveUnreachable,
} from '@/components/site/drive-connect';
import { EmptyCollection } from '@/components/recipes/empty-collection';
import { RecipeCard, RecipeGrid } from '@/components/recipes/recipe-card';
import {
  hrefFor,
  parseQuery,
  type RawParams,
} from '@/components/recipes/search-query';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/field';
import { Container, Heading, SectionHeader } from '@/components/ui/layout';
import {
  easyAndQuick,
  fromTheShelf,
  photosFirst,
  ROW_SIZE,
  todaySeed,
} from '@/components/home/shelves';
import type { ShellUser } from '@/lib/auth/shell-user';
import { countOf } from '@/lib/intl';
import { toCardRecipe, type CardRecipe } from '@/lib/recipe/card-data';
import { loadCollection } from '@/lib/recipe/load-collection';

/** The recipe list at the filters given, as a link. */
function listHref(params: RawParams): string {
  return hrefFor(parseQuery(params));
}

/** One-tap ways into the list. */
const SHORTCUTS: [string, string][] = [
  ['Easy', listHref({ difficulty: 'Easy' })],
  ['Up to 30 min', listHref({ time: '15,30' })],
  ['Vegetarian', listHref({ diet_type: 'Vegetarian' })],
  ['Chicken', listHref({ protein: 'chicken' })],
  ['Favourites', listHref({ fav: '1' })],
];

/** A row of recipes with a heading and a link to see them all; empty rows vanish. */
function Row({
  eyebrow,
  title,
  href,
  items,
}: {
  eyebrow: string;
  title: string;
  href: string;
  items: CardRecipe[];
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="mt-14 sm:mt-16">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        action={
          <Link
            href={href}
            className="focus-visible:outline-ink flex h-10 shrink-0 items-center gap-1.5 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
          >
            See all <ArrowIcon className="h-4 w-4" />
          </Link>
        }
      />
      <div className="mt-6">
        <RecipeGrid columns={4}>
          {items.map((r) => (
            <RecipeCard key={r.id} recipe={r} live />
          ))}
        </RecipeGrid>
      </div>
    </section>
  );
}

/**
 * The signed-in home: ask for ideas, jump back into your own recipes. It reads
 * the user's cached recipes itself (one D1 round trip, with the same sign-in
 * redirects and Drive refresh as the recipe list) and shows a few rows of them,
 * or the offer to connect Google Drive when that hasn't been done.
 */
export async function Dashboard({ user }: { user: ShellUser }) {
  const { recipes: rows, favouriteIds, drive } = await loadCollection('/');
  const hearted = new Set(favouriteIds);
  const recipes = rows.map((row) =>
    toCardRecipe(row, hearted.has(row.drive_file_id)),
  );

  const favourites = photosFirst(recipes.filter((r) => r.favourite)).slice(
    0,
    ROW_SIZE,
  );
  const quick = photosFirst(easyAndQuick(recipes)).slice(0, ROW_SIZE);
  const shown = new Set([...favourites, ...quick].map((r) => r.id));
  const shelf = fromTheShelf(recipes, todaySeed(), shown);
  const favouriteCount = recipes.filter((r) => r.favourite).length;
  // With no recipes and no Drive there is nothing to search or add to yet.
  const needsDrive = !drive.connected && recipes.length === 0;

  return (
    <>
      <section className="border-ink/10 border-b">
        <Container className="py-10 sm:py-14">
          <p className="text-label text-ember flex items-center gap-2 font-semibold uppercase">
            <span className="bg-live h-2 w-2 rounded-full" />
            Welcome back, {user.firstName}
          </p>
          <Heading as="h1" variant="h1" className="mt-3 max-w-3xl">
            What do you feel like cooking?
          </Heading>
          {needsDrive ? null : (
            <>
              <form action="/app" role="search" className="mt-6 max-w-2xl">
                <SearchField
                  size="lg"
                  name="q"
                  placeholder="Try “chicken curry”"
                  aria-label="Describe what you feel like cooking"
                  action={
                    <Button type="submit" size="md" className="h-10">
                      <SearchIcon className="h-4 w-4" />
                      Find
                    </Button>
                  }
                />
              </form>
              <div className="mt-5 flex flex-wrap gap-2">
                {SHORTCUTS.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="border-ink/20 hover:border-ink focus-visible:outline-ink inline-flex h-9 items-center rounded-full border bg-white px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href="/recipes/add"
                  className="bg-ink hover:bg-ink/85 focus-visible:outline-ink inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add recipe
                </Link>
              </div>
            </>
          )}
          {recipes.length > 0 ? (
            <p className="text-ink/65 mt-5 text-sm">
              {countOf(recipes.length, 'recipe')} ·{' '}
              {countOf(favouriteCount, 'favourite')}
            </p>
          ) : null}
        </Container>
      </section>

      <Container className="pb-4">
        {needsDrive ? (
          <div className="mt-14">
            <DriveConnectPanel reconnect={drive.reconnect} returnTo="/" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="mt-14">
            {drive.unreachable ? <DriveUnreachable /> : <EmptyCollection />}
          </div>
        ) : (
          <>
            {drive.connected ? null : (
              <div className="mt-10">
                <DriveConnectNotice reconnect={drive.reconnect} returnTo="/" />
              </div>
            )}
            <Row
              eyebrow="Your favourites"
              title="The ones you keep coming back to"
              href={listHref({ fav: '1' })}
              items={favourites}
            />
            <Row
              eyebrow="Weeknight"
              title="Easy and quick"
              href={listHref({ difficulty: 'Easy', time: '15,30' })}
              items={quick}
            />
            <Row
              eyebrow="Your collection"
              title="Pick something from the shelf"
              href="/app"
              items={shelf}
            />
          </>
        )}
      </Container>

      <div className="mt-16 sm:mt-20">
        <ConnectBand />
      </div>
    </>
  );
}
