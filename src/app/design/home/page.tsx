import Link from 'next/link';

import { ConnectBand } from '@/design/connect-band';
import { RECIPES } from '@/design/fixtures';
import { sentenceCase } from '@/design/format';
import { ArrowIcon } from '@/design/icons';
import { PhotoBlock, RecipeCard, RecipeGrid } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';
import { Button } from '@/design/ui/button';
import { SearchField } from '@/design/ui/field';
import {
  Container,
  Eyebrow,
  Heading,
  Section,
  SectionHeader,
} from '@/design/ui/layout';

const COLLECTIONS: {
  title: string;
  count: string;
  surface: string;
  accent: string;
}[] = [
  {
    title: 'Ready in 30',
    count: '24 recipes',
    surface: 'bg-ink text-white',
    accent: 'text-marigold',
  },
  {
    title: 'Vegetarian',
    count: '17 recipes',
    surface: 'bg-leaf text-ink',
    accent: 'text-ink/70',
  },
  {
    title: 'Slow & comforting',
    count: '12 recipes',
    surface: 'bg-plum text-white',
    accent: 'text-bubblegum',
  },
  {
    title: 'Your favourites',
    count: '5 recipes',
    surface: 'bg-marigold text-ink',
    accent: 'text-ink/70',
  },
];

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Save it',
    body: 'Paste a link or type a recipe. It lands as a plain text file in your own Drive, not ours.',
  },
  {
    n: '02',
    title: 'Find it',
    body: 'Filter by what is in the cupboard, by cuisine or site, or just describe what you feel like.',
  },
  {
    n: '03',
    title: 'Cook it',
    body: 'Ingredients on one side, method on the other, no ads and no life stories.',
  },
];

/** A magazine-style tile in the hero collage: a photo with its title on top. */
function HeroTile({
  recipe,
  className,
}: {
  recipe: (typeof RECIPES)[number];
  className?: string;
}) {
  return (
    <Link
      href="/design/recipe"
      className={`rounded-card border-ink/10 relative block overflow-hidden border ${className ?? ''}`}
    >
      <PhotoBlock
        tone={recipe.tone}
        cover={recipe.cover}
        className="h-full w-full"
      />
      <div className="from-ink/75 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-4 pt-14 text-white">
        <p className="text-label font-semibold uppercase opacity-80">
          {sentenceCase(recipe.cuisine)}
        </p>
        <p className="font-display mt-1 text-lg leading-tight font-semibold">
          {recipe.title}
        </p>
      </div>
    </Link>
  );
}

/** Home screen, signed out by default; add `?user=1` to see it signed in. */
export default async function DesignHome({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const signedIn = (await searchParams).user === '1';
  return (
    <DesignShell signedIn={signedIn} active="home">
      <Container className="grid grid-cols-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div>
          {signedIn ? (
            <p className="text-label text-ember flex items-center gap-2 font-semibold uppercase">
              <span className="bg-leaf h-2 w-2 rounded-full" />
              Welcome back, Mridang
            </p>
          ) : (
            <Eyebrow>Recipes you actually keep</Eyebrow>
          )}
          <Heading as="h1" variant="display" className="mt-5">
            Your recipes.
            <br />
            <em className="text-ember">Your Drive.</em>
            <br />
            Your rules.
          </Heading>
          <p className="text-ink/70 mt-6 max-w-xl text-lg leading-relaxed">
            chowdown keeps every recipe as a plain text file in a folder you
            own, then makes them a pleasure to search, scale and cook from.
          </p>
          <form className="mt-8 max-w-xl">
            <SearchField
              size="lg"
              placeholder="What do you feel like?"
              aria-label="Describe what you feel like cooking"
              action={
                <Button size="md" className="h-10">
                  Search <ArrowIcon className="h-4 w-4" />
                </Button>
              }
            />
          </form>
          <p className="text-ink/60 mt-4 text-sm">
            {signedIn
              ? '85 recipes · 32 Indian · 26 chicken · 5 favourites'
              : 'Free · Sign in with Google · You keep the files'}
          </p>
        </div>

        <div className="grid h-[22rem] grid-cols-2 grid-rows-2 gap-3 sm:h-[30rem] lg:h-[34rem]">
          <HeroTile recipe={RECIPES[0]!} className="row-span-2" />
          <HeroTile recipe={RECIPES[3]!} />
          <HeroTile recipe={RECIPES[1]!} />
        </div>
      </Container>

      <Container className="pb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.title}
              href="/design/search"
              className={`group rounded-card flex aspect-[5/3] flex-col justify-between p-5 transition hover:opacity-95 lg:aspect-[4/3] ${c.surface}`}
            >
              <span
                className={`text-label font-semibold uppercase ${c.accent}`}
              >
                {c.count}
              </span>
              <span className="flex items-end justify-between gap-3">
                <Heading as="span" variant="h3">
                  {c.title}
                </Heading>
                <ArrowIcon className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </Container>

      <Section surface="white" className="mt-12 sm:mt-16">
        <Container>
          <SectionHeader
            eyebrow="This week"
            title="Worth cooking again"
            action={
              <Link
                href="/design/search"
                className="flex h-10 shrink-0 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
              >
                See all <ArrowIcon className="h-4 w-4" />
              </Link>
            }
          />
          <div className="mt-8">
            <RecipeGrid columns={4}>
              {RECIPES.slice(0, 4).map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </RecipeGrid>
          </div>
        </Container>
      </Section>

      <ConnectBand />

      <Section surface="ink">
        <Container>
          <Eyebrow className="text-marigold">How it works</Eyebrow>
          <Heading className="mt-2 max-w-xl">Three steps, no lock-in</Heading>
          <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t border-white/20 pt-6">
                <span className="font-display text-marigold text-5xl font-semibold italic">
                  {step.n}
                </span>
                <Heading as="h3" variant="h3" className="mt-4">
                  {step.title}
                </Heading>
                <p className="mt-2 max-w-sm leading-relaxed text-white/70">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </DesignShell>
  );
}
