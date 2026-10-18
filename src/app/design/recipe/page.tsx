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

/** A round action button: favourite, auto-tag, delete. */
function RoundButton({
  label,
  children,
  tone = 'bg-white',
}: {
  label: string;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`border-ink hover:bg-marigold grid h-11 w-11 place-items-center rounded-full border-2 transition ${tone}`}
    >
      {children}
    </button>
  );
}

/** One fact in the row under the hero: an icon and a label. */
function Fact({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div className="flex items-center gap-3 px-6 first:pl-0">
      <span className="text-flame">{icon}</span>
      <span className="font-display text-sm tracking-wide uppercase">
        {children}
      </span>
    </div>
  );
}

/**
 * Recipe screen, laid out like a printed recipe card: a calm split hero (title
 * and intro beside a full-bleed photo), a row of facts with line icons, then a
 * narrow ingredient column beside the numbered method — with plenty of space.
 */
export default function DesignRecipe() {
  return (
    <DesignShell signedIn active="search">
      <section className="border-ink border-b-2">
        <div className="mx-auto grid max-w-[90rem] lg:grid-cols-2">
          <div className="px-4 py-10 sm:px-8 lg:py-16 lg:pr-16 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
            <nav className="text-ink/60 text-sm" aria-label="Breadcrumb">
              <Link href="/design/search" className="hover:underline">
                Recipes
              </Link>{' '}
              /{' '}
              <Link href="/design/search" className="hover:underline">
                Mexican
              </Link>{' '}
              / <span className="text-ink">{R.title}</span>
            </nav>
            <h1 className="font-display text-flame mt-8 text-4xl leading-[1.02] tracking-tight uppercase sm:text-6xl">
              {R.title}
            </h1>
            <div className="mt-6 flex items-center gap-2.5">
              <RoundButton label="Favourite">
                <HeartIcon className="h-5 w-5" />
              </RoundButton>
              <RoundButton label="Auto-tag">
                <SparkIcon className="h-5 w-5" />
              </RoundButton>
              <RoundButton label="Delete">
                <TrashIcon className="h-5 w-5" />
              </RoundButton>
            </div>
            <p className="mt-8 flex flex-wrap items-center gap-3 text-lg">
              <span className="font-display text-sm tracking-wide uppercase">
                From
              </span>
              <a
                href="https://example.com"
                className="inline-flex items-center gap-1.5 underline decoration-2 underline-offset-4"
              >
                <LinkIcon className="h-4 w-4" />
                {R.site}
              </a>
              <Link
                href="/design/search"
                className="border-ink font-display hover:bg-marigold rounded-full border-2 px-3 py-0.5 text-[11px] tracking-wide uppercase transition"
              >
                More from {R.site}
              </Link>
            </p>
            <p className="text-ink/80 mt-5 max-w-xl text-xl leading-relaxed">
              {R.intro}
            </p>
          </div>
          <PhotoBlock
            tone="flame"
            className="lg:border-ink min-h-72 lg:min-h-[28rem] lg:border-l-2"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="divide-flame/60 mt-12 flex flex-wrap items-center divide-x-2">
          <Fact
            icon={<ClockIcon className="h-8 w-8" />}
          >{`${R.minutes} min`}</Fact>
          <Fact icon={<FlameIcon className="h-8 w-8" />}>{R.difficulty}</Fact>
          <Fact
            icon={<ServingsIcon className="h-8 w-8" />}
          >{`Serves ${R.servings}`}</Fact>
        </div>

        <div className="mt-14 grid gap-14 md:grid-cols-[18rem_1fr] lg:grid-cols-[22rem_1fr]">
          <div>
            <h2 className="font-display text-flame text-2xl tracking-wide uppercase">
              Ingredients
            </h2>
            <ul className="mt-5 flex flex-col gap-2.5 text-xl">
              {R.ingredients.map(([qty, name]) => (
                <li key={name} className="flex gap-3">
                  <span className="bg-flame mt-2.5 h-2 w-2 shrink-0 rounded-full" />
                  <span>
                    {qty ? (
                      <strong className="font-semibold">{qty} </strong>
                    ) : null}
                    {name}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="font-display mt-10 text-sm tracking-[0.15em] uppercase">
              You will need
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-lg">
              {R.cookware.map((c) => (
                <li key={c} className="flex items-center gap-2.5">
                  <PanIcon className="text-flame h-5 w-5" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-flame text-2xl tracking-wide uppercase">
              Method
            </h2>
            <ol className="mt-5 flex flex-col gap-7">
              {R.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-5">
                  <span className="bg-flame font-display grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1.5 text-xl leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <hr className="border-flame/40 mt-16 border-t-2" />
        <p className="font-display text-ink/60 mt-6 text-sm tracking-[0.15em] uppercase">
          {R.tags.join(', ')}
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-8">
        <h2 className="font-display text-3xl uppercase">You might also like</h2>
        <div className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {RECIPES.slice(3, 7).map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      </section>
    </DesignShell>
  );
}
