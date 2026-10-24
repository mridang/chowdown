import Link from 'next/link';
import type { ReactElement } from 'react';

import { ArrowIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { ConnectBand } from '@/components/site/connect-band';
import {
  DriveConnectNotice,
  DriveConnectPanel,
  DriveUnreachable,
} from '@/components/site/drive-connect';
import type { NavLink } from '@/components/site/nav-links';
import { EmptyCollection } from '@/components/recipes/empty-collection';
import { RecipeCard, RecipeGrid } from '@/components/recipes/recipe-card';
import {
  hrefFor,
  parseQuery,
  type RawParams,
} from '@/components/recipes/search-query';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/field';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { PillLink } from '@/components/ui/pill';
import { SectionHeader } from '@/components/ui/section';
import {
  easyAndQuick,
  fromTheShelf,
  photosFirst,
  ROW_SIZE,
  todaySeed,
} from '@/components/home/shelves';
import type { ShellUser } from '@/core/auth/shell-user';
import { countOf } from '@/lib/intl';
import { toCardRecipe, type CardRecipe } from '@/domain/recipe/card-data';
import { loadCollection } from '@/domain/recipe/load-collection';

/** The recipe list at the filters given, as a link. */
function listHref(params: RawParams): string {
  return hrefFor(parseQuery(params));
}

/** One-tap ways into the list. */
const SHORTCUTS: readonly NavLink[] = [
  { label: 'Easy', href: listHref({ difficulty: 'Easy' }) },
  { label: 'Up to 30 min', href: listHref({ time: '15,30' }) },
  { label: 'Vegetarian', href: listHref({ diet_type: 'Vegetarian' }) },
  { label: 'Chicken', href: listHref({ protein: 'chicken' }) },
  { label: 'Favourites', href: listHref({ fav: '1' }) },
];

/** A row of recipes with a heading and a link to see them all; empty rows vanish. */
function Row({
  eyebrow,
  title,
  href,
  items,
}: Readonly<{
  eyebrow: string;
  title: string;
  /** Where "See all" goes. */
  href: string;
  items: readonly CardRecipe[];
}>): ReactElement | null {
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
            className="focus-ring-flush flex h-10 shrink-0 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            See all <ArrowIcon size="sm" />
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
export async function Dashboard({
  user,
}: Readonly<{ user: ShellUser }>): Promise<ReactElement> {
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
      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <Eyebrow className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-live" />
            Welcome back, {user.firstName}
          </Eyebrow>
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
                    <Button type="submit" size="md">
                      <SearchIcon size="sm" />
                      Find
                    </Button>
                  }
                />
              </form>
              <div className="mt-5 flex flex-wrap gap-2">
                {SHORTCUTS.map(({ label, href }) => (
                  <PillLink key={label} href={href}>
                    {label}
                  </PillLink>
                ))}
                <PillLink href="/recipes/add" variant="solid">
                  <PlusIcon size="sm" />
                  Add recipe
                </PillLink>
              </div>
            </>
          )}
          {recipes.length > 0 ? (
            <p className="mt-5 text-sm text-subtle">
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
