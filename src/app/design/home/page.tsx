import Link from 'next/link';

import { ConnectBand } from '@/design/connect-band';
import { loadRecipes } from '@/design/data';
import { ArrowIcon, SearchIcon } from '@/design/icons';
import {
  Faq,
  FinalCta,
  Features,
  HeroVisual,
  Numbers,
  PhotoStrip,
  SignInButton,
  WorksWith,
} from '@/design/landing';
import { RecipeCard, RecipeGrid } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';
import { Button, ButtonLink } from '@/design/ui/button';
import { SearchField } from '@/design/ui/field';
import { Container, Eyebrow, Heading, SectionHeader } from '@/design/ui/layout';

/** The signed-out visitor's home: what chowdown is, why, and a way in. */
function Landing() {
  const recipes = loadRecipes();
  const withPhoto = recipes.filter((r) => r.cover);
  const hero =
    withPhoto.find(
      (r) => r.cooklang && r.difficulty === 'Easy' && r.protein === 'chicken',
    ) ?? withPhoto[0]!;
  const strip = withPhoto.filter((_, i) => i % 11 === 5).slice(0, 6);
  return (
    <DesignShell signedIn={false} active="home">
      <Container className="grid grid-cols-1 items-center gap-14 py-12 lg:grid-cols-[0.95fr_1.1fr] lg:gap-16 lg:py-20">
        <div>
          <Eyebrow>Recipes you actually keep</Eyebrow>
          <Heading as="h1" variant="display" className="mt-5">
            Your recipes.
            <br />
            <em className="text-ember">Your Drive.</em>
            <br />
            Your rules.
          </Heading>
          <p className="text-ink/75 mt-6 max-w-xl text-lg leading-relaxed">
            chowdown keeps every recipe as a plain text file in a folder you
            own, then makes them a pleasure to search, scale and cook from, and
            ready for your AI assistant.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignInButton />
            <ButtonLink href="#features" variant="outline" size="lg">
              See what it does
            </ButtonLink>
          </div>
          <WorksWith />
        </div>
        <div className="lg:pb-10">
          <HeroVisual recipe={hero} />
        </div>
      </Container>
      <PhotoStrip recipes={strip} />
      <Numbers recipes={recipes} />
      <Features recipes={recipes} />
      <Faq />
      <FinalCta />
    </DesignShell>
  );
}

/** A row of recipes with a heading and a link to see them all. */
function Row({
  eyebrow,
  title,
  href,
  items,
}: {
  eyebrow: string;
  title: string;
  href: string;
  items: ReturnType<typeof loadRecipes>;
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
            className="flex h-10 shrink-0 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            See all <ArrowIcon className="h-4 w-4" />
          </Link>
        }
      />
      <div className="mt-6">
        <RecipeGrid columns={4}>
          {items.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </RecipeGrid>
      </div>
    </section>
  );
}

/** The signed-in home: ask for ideas, jump back into your own recipes. */
function Dashboard() {
  const recipes = loadRecipes();
  const withPhoto = recipes.filter((r) => r.cover);
  const favourites = withPhoto.filter((r) => r.favourite).slice(0, 4);
  const quick = withPhoto
    .filter((r) => r.minutes <= 30 && r.difficulty === 'Easy')
    .slice(0, 4);
  const lately = withPhoto.filter((_, i) => i % 9 === 2).slice(0, 4);
  const shortcuts: [string, string][] = [
    ['Easy', '/design/search?difficulty=Easy'],
    ['Up to 30 min', '/design/search?time=15,30'],
    ['Vegetarian', '/design/search?diet=Vegetarian'],
    ['Chicken', '/design/search?protein=chicken'],
    ['Favourites', '/design/search?fav=1'],
  ];
  return (
    <DesignShell signedIn active="home">
      <section className="border-ink/10 border-b">
        <Container className="py-10 sm:py-14">
          <p className="text-label text-ember flex items-center gap-2 font-semibold uppercase">
            <span className="bg-live h-2 w-2 rounded-full" />
            Welcome back, Mridang
          </p>
          <Heading as="h1" variant="h1" className="mt-3 max-w-3xl">
            What do you feel like cooking?
          </Heading>
          <form action="/design/search" className="mt-6 max-w-2xl">
            <SearchField
              size="lg"
              name="q"
              placeholder="Try “something light with chicken”"
              aria-label="Describe what you feel like cooking"
              action={
                <Button size="md" className="h-10">
                  <SearchIcon className="h-4 w-4" />
                  Find
                </Button>
              }
            />
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {shortcuts.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="border-ink/20 hover:border-ink inline-flex h-9 items-center rounded-full border bg-white px-4 text-sm font-medium transition"
              >
                {label}
              </Link>
            ))}
          </div>
          <p className="text-ink/65 mt-5 text-sm">
            {recipes.length} recipes ·{' '}
            {recipes.filter((r) => r.favourite).length} favourites
          </p>
        </Container>
      </section>

      <Container className="pb-4">
        <Row
          eyebrow="Your favourites"
          title="The ones you keep coming back to"
          href="/design/search?fav=1"
          items={favourites}
        />
        <Row
          eyebrow="Weeknight"
          title="Easy and quick"
          href="/design/search?difficulty=Easy&time=15,30"
          items={quick}
        />
        <Row
          eyebrow="Your collection"
          title="Pick something from the shelf"
          href="/design/search"
          items={lately}
        />
      </Container>

      <div className="mt-16 sm:mt-20">
        <ConnectBand />
      </div>
    </DesignShell>
  );
}

/** Home: the landing page for visitors, the dashboard (`?user=1`) when signed in. */
export default async function DesignHome({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  return (await searchParams).user === '1' ? <Dashboard /> : <Landing />;
}
