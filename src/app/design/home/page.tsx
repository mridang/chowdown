import {
  ArrowIcon,
  CarrotIcon,
  HeartIcon,
  LeafIcon,
  PanIcon,
  SearchIcon,
  SparkIcon,
} from '@/design/icons';
import { RECIPES } from '@/design/fixtures';
import { RecipeCard } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';

const CATEGORIES: [string, React.ReactNode][] = [
  ['Quick', <SparkIcon key="q" className="h-6 w-6" />],
  ['Veggie', <LeafIcon key="v" className="h-6 w-6" />],
  ['Comfort', <PanIcon key="c" className="h-6 w-6" />],
  ['Favourites', <HeartIcon key="f" className="h-6 w-6" />],
  ['Pantry', <CarrotIcon key="p" className="h-6 w-6" />],
];

const STEPS: [string, string, string, string][] = [
  [
    '1',
    'Save it',
    'Paste a link or type a recipe. It lands as a plain text file in your Drive.',
    'bg-leaf',
  ],
  [
    '2',
    'Find it',
    'Search, filter by what you have, or just say what you feel like.',
    'bg-bubblegum',
  ],
  [
    '3',
    'Cook it',
    'Big ingredients, clear steps, no ads, no life stories.',
    'bg-plum text-white',
  ],
];

/** Home screen, signed out by default; add `?user=1` to see it signed in. */
export default async function DesignHome({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const signedIn = (await searchParams).user === '1';
  return (
    <DesignShell signedIn={signedIn} active="home">
      <section className="border-ink border-b-2">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:py-20">
          <div>
            <p className="border-ink bg-marigold font-display inline-block -rotate-1 rounded-full border-2 px-4 py-1 text-xs tracking-[0.2em] uppercase">
              {signedIn ? 'Welcome back, Mridang' : 'Recipes you actually keep'}
            </p>
            <h1 className="font-display mt-6 text-5xl leading-[0.95] tracking-tight uppercase sm:text-7xl">
              Your recipes.
              <br />
              <span className="text-flame">Your Drive.</span>
              <br />
              Your rules.
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-snug">
              chowdown keeps every recipe as a plain text file in a folder you
              own, then makes them a joy to search, scale and cook from.
            </p>
            <form className="border-ink mt-8 flex max-w-xl items-center gap-2 rounded-full border-2 bg-white p-1.5 shadow-[5px_5px_0_0_var(--color-ink)]">
              <SearchIcon className="ml-3 h-6 w-6 shrink-0" />
              <input
                placeholder="What do you feel like?"
                className="placeholder:text-ink/50 min-w-0 flex-1 bg-transparent px-2 py-2 text-lg outline-none"
              />
              <button
                type="button"
                className="border-ink bg-flame font-display flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm tracking-wide text-white uppercase"
              >
                Find <ArrowIcon className="h-4 w-4" />
              </button>
            </form>
            {signedIn ? null : (
              <p className="font-display mt-4 text-xs tracking-wide uppercase">
                Free · Sign in with Google · You keep the files
              </p>
            )}
          </div>
          <div className="relative hidden lg:block">
            <div className="border-ink bg-marigold absolute inset-0 rotate-3 rounded-[2rem] border-2" />
            <div className="border-ink bg-flame relative -rotate-2 rounded-[2rem] border-2 p-8 text-white shadow-[8px_8px_0_0_var(--color-ink)]">
              <PanIcon className="h-24 w-24" strokeWidth={1.4} />
              <p className="font-display mt-4 text-3xl leading-tight uppercase">
                85 recipes ready to cook
              </p>
              <p className="mt-2 font-serif text-lg">
                32 Indian · 26 chicken · 5 favourites
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(([label, icon]) => (
            <a
              key={label}
              href="/design/search"
              className="border-ink font-display hover:bg-marigold flex items-center gap-2 rounded-full border-2 bg-white px-5 py-2.5 text-sm tracking-wide uppercase transition"
            >
              {icon}
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl uppercase sm:text-4xl">
            Cook this week
          </h2>
          <a
            href="/design/search"
            className="font-display flex items-center gap-1.5 text-sm uppercase underline underline-offset-4"
          >
            See all <ArrowIcon className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {RECIPES.slice(0, 4).map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-8">
        <h2 className="font-display text-3xl uppercase sm:text-4xl">
          How it works
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map(([n, title, body, tone]) => (
            <div
              key={n}
              className={`border-ink rounded-2xl border-2 p-6 shadow-[5px_5px_0_0_var(--color-ink)] ${tone}`}
            >
              <span className="border-ink font-display text-ink grid h-12 w-12 place-items-center rounded-full border-2 bg-white text-2xl">
                {n}
              </span>
              <h3 className="font-display mt-4 text-2xl uppercase">{title}</h3>
              <p className="mt-2 text-lg leading-snug">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </DesignShell>
  );
}
