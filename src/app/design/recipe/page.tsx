import Link from 'next/link';
import type { ReactNode } from 'react';

import { loadRecipePage, loadRecipes } from '@/design/data';
import { sentenceCase } from '@/design/format';
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
import { PhotoBlock, RecipeCard, RecipeGrid } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';
import { Button } from '@/design/ui/button';
import { Container, Eyebrow, Heading } from '@/design/ui/layout';

/** One fact in the row under the hero: a line icon, a label and a value. */
function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3.5 sm:px-8 sm:first:pl-0">
      <span className="text-ember">{icon}</span>
      <span className="leading-tight">
        <span className="text-label text-ink/65 block font-semibold uppercase">
          {label}
        </span>
        <span className="block text-base font-semibold">{value}</span>
      </span>
    </div>
  );
}

/** A small tracked-caps subheading inside the ingredients column. */
function Label({ children }: { children: ReactNode }) {
  return <h3 className="text-label font-semibold uppercase">{children}</h3>;
}

/**
 * Recipe screen, laid out like a printed recipe card: a split hero (title and
 * intro beside a full-bleed photo; stacked, photo first, on phones), a row of
 * facts with line icons, then a narrow ingredient column beside the numbered
 * method. The ingredients stay in view while you scroll the method.
 */
export default async function DesignRecipe({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const R = loadRecipePage(id);
  const related = loadRecipes()
    .filter((r) => r.cuisine === R.cuisine && r.title !== R.title)
    .concat(loadRecipes())
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .slice(0, 4);
  return (
    <DesignShell signedIn active="search">
      <section className="border-ink/10 @container border-b">
        {/*
          The text column must start exactly where the page container does, so
          the title, the facts and the ingredients share one left edge. The photo
          bleeds to the right edge, so the container gutter is rebuilt here from
          the section width (cqw) rather than nested.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <PhotoBlock
            tone="flame"
            cover={R.cover}
            className="aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[32rem]"
          />
          <div className="px-4 py-8 sm:px-6 lg:order-1 lg:py-16 lg:pr-16 lg:pl-[max(2.5rem,calc((100cqw-90rem)/2+2.5rem))]">
            <nav className="text-ink/65 text-sm" aria-label="Breadcrumb">
              <Link
                href="/design/search"
                className="hover:text-ink inline-flex h-8 items-center hover:underline"
              >
                Recipes
              </Link>
              <span className="mx-1.5">/</span>
              <Link
                href="/design/search"
                className="hover:text-ink inline-flex h-8 items-center hover:underline"
              >
                {sentenceCase(R.cuisine)}
              </Link>
            </nav>
            <Eyebrow className="mt-6">
              {sentenceCase(R.cuisine)} · {sentenceCase(R.protein)}
            </Eyebrow>
            <Heading as="h1" variant="h1" className="mt-3 lg:text-6xl">
              {R.title}
            </Heading>
            <p className="text-ink/75 mt-6 max-w-xl text-lg leading-relaxed">
              {R.intro}
            </p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-ink/65">From</span>
              <a
                href="https://example.com"
                className="inline-flex h-8 items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                <LinkIcon className="h-4 w-4" />
                {R.site}
              </a>
              <Link
                href="/design/search"
                className="rounded-control border-ink/25 hover:border-ink inline-flex h-8 items-center border px-2.5 text-xs font-medium transition"
              >
                More from {R.site}
              </Link>
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button variant="outline">
                <HeartIcon className="h-[18px] w-[18px]" />
                Favourite
              </Button>
              <Button variant="outline">
                <SparkIcon className="h-[18px] w-[18px]" />
                Auto-tag
              </Button>
              <Button variant="outline">
                <TrashIcon className="h-[18px] w-[18px]" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Container>
        <div className="sm:divide-ink/15 mt-10 flex flex-wrap items-center gap-x-8 gap-y-5 sm:gap-x-0 sm:divide-x">
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

        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-20">
          <div className="md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:pr-2">
            <Heading variant="h3">Ingredients</Heading>
            <ul className="divide-ink/10 border-ink/10 mt-5 divide-y border-y">
              {R.ingredients.map(([qty, name], i) => (
                <li key={`${name}-${i}`} className="flex gap-4 py-3 text-base">
                  <span className="w-20 shrink-0 font-semibold">{qty}</span>
                  <span className="text-ink/85">{name}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Label>You will need</Label>
              <ul className="mt-3 flex flex-col gap-2 text-[15px]">
                {R.cookware.map((c, i) => (
                  <li key={`${c}-${i}`} className="flex items-center gap-2.5">
                    <PanIcon className="text-ember h-[18px] w-[18px]" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <Heading variant="h3">Method</Heading>
            <ol className="mt-5 flex max-w-3xl flex-col gap-8">
              {R.steps.map((step, i) => (
                <li
                  key={`${i}-${step.slice(0, 12)}`}
                  className="flex items-start gap-5"
                >
                  <span className="bg-flame text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-semibold">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-lg leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <hr className="border-ink/15 mt-16 border-t" />
        <p className="text-label text-ink/65 mt-5 font-semibold uppercase">
          {R.tags.join(' · ')}
        </p>
      </Container>

      <Container className="mt-16">
        <Heading>You might also like</Heading>
        <div className="mt-6">
          <RecipeGrid columns={4}>
            {related.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </RecipeGrid>
        </div>
      </Container>
    </DesignShell>
  );
}
