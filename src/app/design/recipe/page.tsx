import Link from 'next/link';

import { RECIPES, RECIPE_PAGE as R } from '@/design/fixtures';
import {
  ClockIcon,
  FlameIcon,
  HeartIcon,
  LinkIcon,
  PanIcon,
  ServingsIcon,
  SparkIcon,
  TrashIcon,
} from '@/design/icons';
import { PhotoBlock, RecipeCard } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';

/** A labelled action beside the title: favourite, auto-tag, delete. */
function Action({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="border-ink/20 hover:border-ink inline-flex items-center gap-2 rounded-md border bg-white px-3.5 py-2 text-sm font-medium transition"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

/** One fact in the row under the hero: a line icon, a label and a value. */
function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3.5 px-5 first:pl-0 sm:px-8">
      <span className="text-ember">{icon}</span>
      <span className="leading-tight">
        <span className="text-ink/55 block text-[11px] font-semibold tracking-[0.16em] uppercase">
          {label}
        </span>
        <span className="block text-base font-semibold">{value}</span>
      </span>
    </div>
  );
}

/**
 * Recipe screen, laid out like a printed recipe card: a split hero (title and
 * intro beside a full-bleed photo; stacked, photo first, on phones), a row of
 * facts with line icons, then a narrow ingredient column beside the numbered
 * method. The ingredients stay in view while you scroll the method.
 */
export default function DesignRecipe() {
  return (
    <DesignShell signedIn active="search">
      <section className="border-ink/10 border-b">
        <div className="mx-auto grid max-w-[90rem] lg:grid-cols-2">
          <PhotoBlock
            tone="flame"
            className="aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[30rem]"
          />
          <div className="px-4 py-8 sm:px-8 lg:order-1 lg:py-16 lg:pr-16 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
            <nav className="text-ink/55 text-sm" aria-label="Breadcrumb">
              <Link
                href="/design/search"
                className="hover:text-ink hover:underline"
              >
                Recipes
              </Link>{' '}
              /{' '}
              <Link
                href="/design/search"
                className="hover:text-ink hover:underline"
              >
                Mexican
              </Link>
            </nav>
            <p className="text-ember mt-6 text-xs font-semibold tracking-[0.18em] uppercase">
              Mexican · Chicken
            </p>
            <h1 className="font-display mt-3 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {R.title}
            </h1>
            <p className="text-ink/75 mt-6 max-w-xl text-lg leading-relaxed">
              {R.intro}
            </p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-ink/55">From</span>
              <a
                href="https://example.com"
                className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                <LinkIcon className="h-4 w-4" />
                {R.site}
              </a>
              <Link
                href="/design/search"
                className="border-ink/20 hover:border-ink rounded border px-2.5 py-1 text-xs font-medium transition"
              >
                More from {R.site}
              </Link>
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Action label="Favourite">
                <HeartIcon className="h-[18px] w-[18px]" />
              </Action>
              <Action label="Auto-tag">
                <SparkIcon className="h-[18px] w-[18px]" />
              </Action>
              <Action label="Delete">
                <TrashIcon className="h-[18px] w-[18px]" />
              </Action>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="divide-ink/15 mt-10 flex flex-wrap items-center gap-y-5 sm:divide-x">
          <Fact
            icon={<ClockIcon className="h-7 w-7" />}
            label="Time"
            value={`${R.minutes} min`}
          />
          <Fact
            icon={<FlameIcon className="h-7 w-7" />}
            label="Difficulty"
            value={R.difficulty}
          />
          <Fact
            icon={<ServingsIcon className="h-7 w-7" />}
            label="Serves"
            value={String(R.servings)}
          />
        </div>

        <div className="mt-12 grid gap-12 md:grid-cols-[17rem_1fr] lg:grid-cols-[22rem_1fr] lg:gap-20">
          <div className="md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:pr-2">
            <h2 className="font-display text-2xl font-semibold">Ingredients</h2>
            <ul className="divide-ink/10 border-ink/10 mt-5 flex flex-col divide-y border-y">
              {R.ingredients.map(([qty, name]) => (
                <li key={name} className="flex gap-4 py-3 text-base">
                  <span className="w-20 shrink-0 font-semibold">{qty}</span>
                  <span className="text-ink/85">{name}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-8 text-[11px] font-semibold tracking-[0.18em] uppercase">
              You will need
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-[15px]">
              {R.cookware.map((c) => (
                <li key={c} className="flex items-center gap-2.5">
                  <PanIcon className="text-ember h-[18px] w-[18px]" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold">Method</h2>
            <ol className="mt-5 flex flex-col gap-8">
              {R.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-5">
                  <span className="bg-flame grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-semibold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-lg leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <hr className="border-ink/15 mt-16 border-t" />
        <p className="text-ink/55 mt-5 text-[11px] font-semibold tracking-[0.18em] uppercase">
          {R.tags.join(' · ')}
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-8">
        <h2 className="font-display text-3xl font-semibold">
          You might also like
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {RECIPES.slice(3, 7).map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      </section>
    </DesignShell>
  );
}
