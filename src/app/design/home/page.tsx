import Link from 'next/link';

import { RECIPES } from '@/design/fixtures';
import { ArrowIcon, SearchIcon } from '@/design/icons';
import { PhotoBlock, RecipeCard } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';

const COLLECTIONS: [string, string, string, string][] = [
  ['Ready in 30', '24 recipes', 'bg-ink text-white', 'text-marigold'],
  ['Vegetarian', '17 recipes', 'bg-leaf text-ink', 'text-ink'],
  ['Slow & comforting', '12 recipes', 'bg-plum text-white', 'text-bubblegum'],
  ['Your favourites', '5 recipes', 'bg-marigold text-ink', 'text-ember'],
];

const STEPS: [string, string, string][] = [
  [
    'Save it',
    'Paste a link or type a recipe. It lands as a plain text file in your own Drive, not ours.',
    '01',
  ],
  [
    'Find it',
    'Filter by what is in the cupboard, by cuisine or site, or just describe what you feel like.',
    '02',
  ],
  [
    'Cook it',
    'Ingredients on one side, method on the other, no ads and no life stories.',
    '03',
  ],
];

/** A magazine-style tile in the hero collage. */
function HeroTile({
  recipe,
  className,
}: {
  recipe: (typeof RECIPES)[number];
  className: string;
}) {
  return (
    <Link
      href="/design/recipe"
      className={`group border-ink/10 relative overflow-hidden rounded-lg border ${className}`}
    >
      <PhotoBlock
        tone={recipe.tone}
        cover={recipe.cover}
        className="h-full w-full"
      />
      <div className="from-ink/70 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-4 pt-12 text-white">
        <p className="text-[10px] font-semibold tracking-[0.16em] uppercase opacity-80">
          {recipe.cuisine}
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
      <section>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="text-ember flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase">
              {signedIn ? (
                <>
                  <span className="bg-leaf h-2 w-2 rounded-full" />
                  Welcome back, Mridang
                </>
              ) : (
                'Recipes you actually keep'
              )}
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[1.04] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Your recipes.
              <br />
              <em className="text-ember">Your Drive.</em>
              <br />
              Your rules.
            </h1>
            <p className="text-ink/70 mt-6 max-w-xl text-lg leading-relaxed">
              chowdown keeps every recipe as a plain text file in a folder you
              own, then makes them a pleasure to search, scale and cook from.
            </p>
            <form className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
              <label className="border-ink/20 focus-within:border-ink flex flex-1 items-center gap-3 rounded-md border bg-white px-4">
                <SearchIcon className="text-ink/60 h-5 w-5 shrink-0" />
                <input
                  placeholder="What do you feel like?"
                  className="placeholder:text-ink/45 h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
                />
              </label>
              <button
                type="button"
                className="bg-ink hover:bg-ink/85 flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold text-white transition"
              >
                Search <ArrowIcon className="h-4 w-4" />
              </button>
            </form>
            <p className="text-ink/60 mt-4 text-sm">
              {signedIn
                ? '85 recipes · 32 Indian · 26 chicken · 5 favourites'
                : 'Free · Sign in with Google · You keep the files'}
            </p>
          </div>

          <div className="grid h-[22rem] grid-cols-2 grid-rows-2 gap-3 sm:h-[30rem] lg:h-[34rem]">
            <HeroTile recipe={RECIPES[0]!} className="row-span-2" />
            <HeroTile recipe={RECIPES[3]!} className="" />
            <HeroTile recipe={RECIPES[1]!} className="" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLLECTIONS.map(([title, count, tone, accent]) => (
            <Link
              key={title}
              href="/design/search"
              className={`group flex aspect-[5/3] flex-col justify-between rounded-lg p-5 transition hover:opacity-95 sm:aspect-[4/3] ${tone}`}
            >
              <span
                className={`text-xs font-semibold tracking-[0.16em] uppercase ${accent}`}
              >
                {count}
              </span>
              <span className="flex items-end justify-between gap-3">
                <span className="font-display text-2xl leading-tight font-semibold sm:text-[1.7rem]">
                  {title}
                </span>
                <ArrowIcon className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 bg-white py-16 sm:mt-24 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-ember text-xs font-semibold tracking-[0.18em] uppercase">
                This week
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
                Worth cooking again
              </h2>
            </div>
            <Link
              href="/design/search"
              className="flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
            >
              See all <ArrowIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RECIPES.slice(0, 4).map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20">
          <p className="text-marigold text-xs font-semibold tracking-[0.18em] uppercase">
            How it works
          </p>
          <h2 className="font-display mt-2 max-w-xl text-3xl font-semibold sm:text-4xl">
            Three steps, no lock-in
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map(([title, body, n]) => (
              <div key={n} className="border-t border-white/20 pt-6">
                <span className="font-display text-marigold text-5xl font-semibold italic">
                  {n}
                </span>
                <h3 className="font-display mt-4 text-2xl font-semibold">
                  {title}
                </h3>
                <p className="mt-2 max-w-sm leading-relaxed text-white/70">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </DesignShell>
  );
}
