import Link from 'next/link';
import type { ReactNode } from 'react';

import { loadRecipePage, loadRecipes } from '@/design/data';
import { sentenceCase, duration } from '@/design/format';
import {
  ClockIcon,
  GlobeIcon,
  LeafIcon,
  LinkIcon,
  NoteIcon,
  OvenIcon,
  PlateIcon,
  ProteinIcon,
  ServingsIcon,
} from '@/design/icons';
import { PhotoBlock, RecipeCard, RecipeGrid } from '@/design/recipe-card';
import {
  FavouriteToggle,
  MoreMenu,
  ShareButton,
} from '@/design/recipe/actions';
import { CookMode } from '@/design/recipe/cook-mode';
import { IngredientsPanel } from '@/design/recipe/ingredients-panel';
import { DesignShell } from '@/design/shell';
import { Tag } from '@/design/ui/chip';
import { Difficulty } from '@/design/ui/difficulty';
import { Container, Eyebrow, Heading } from '@/design/ui/layout';

/** One fact: a line icon in a tinted square, a small label and the value. */
function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="rounded-control bg-sand text-ember grid h-11 w-11 shrink-0 place-items-center">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <dt className="text-label text-ink/65 font-semibold uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-base font-semibold">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Recipe screen, laid out like a printed recipe card: a split hero (title,
 * actions and source beside a full-bleed photo; stacked, photo first, on
 * phones), a grid of facts with icons, then the ingredient column (with servings
 * and unit controls) beside the numbered method, then notes and similar recipes.
 * Cook mode opens a full-screen, one-step-at-a-time view.
 */
export default async function DesignRecipe({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const R = loadRecipePage(id);
  const all = loadRecipes();
  const related = all
    .filter((r) => r.cuisine === R.cuisine && r.id !== R.id)
    .concat(all.filter((r) => r.id !== R.id))
    .filter((r, i, list) => list.findIndex((x) => x.id === r.id) === i)
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
          <div className="px-4 py-8 sm:px-6 lg:order-1 lg:py-14 lg:pr-16 lg:pl-[max(2.5rem,calc((100cqw-90rem)/2+2.5rem))]">
            <nav className="text-ink/65 text-sm" aria-label="Breadcrumb">
              <Link
                href="/design/search"
                className="hover:text-ink inline-flex h-8 items-center hover:underline"
              >
                Recipes
              </Link>
              <span className="mx-1.5">/</span>
              <Link
                href={`/design/search?cuisine=${encodeURIComponent(R.cuisine)}`}
                className="hover:text-ink inline-flex h-8 items-center hover:underline"
              >
                {sentenceCase(R.cuisine)}
              </Link>
            </nav>
            <Eyebrow className="mt-5">
              {sentenceCase(R.cuisine)} · {sentenceCase(R.category)}
            </Eyebrow>
            <Heading as="h1" variant="h1" className="mt-3 lg:text-6xl">
              {R.title}
            </Heading>
            {R.intro ? (
              <p className="text-ink/75 mt-5 max-w-xl text-lg leading-relaxed">
                {R.intro}
              </p>
            ) : null}
            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-ink/65">From</span>
              <a
                href="https://example.com"
                className="inline-flex h-8 items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                <LinkIcon className="h-4 w-4" />
                {R.site}
              </a>
              <Link
                href={`/design/search?site=${encodeURIComponent(R.site)}`}
                className="rounded-control border-ink/25 hover:border-ink inline-flex h-8 items-center border px-2.5 text-xs font-medium transition"
              >
                More from {R.site}
              </Link>
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <CookMode title={R.title} steps={R.steps} />
              <FavouriteToggle initial={R.favourite} />
              <ShareButton title={R.title} />
              <MoreMenu />
            </div>
          </div>
        </div>
      </section>

      <Container>
        <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<ClockIcon className="h-6 w-6" />} label="Total time">
            {duration(R.minutes)}
          </Fact>
          <Fact icon={<ServingsIcon className="h-6 w-6" />} label="Serves">
            {R.servings}
          </Fact>
          <Fact
            icon={
              <Difficulty
                level={R.difficulty}
                showLabel={false}
                className="scale-125"
              />
            }
            label="Difficulty"
          >
            {R.difficulty}
          </Fact>
          <Fact
            icon={<ProteinIcon protein={R.protein} className="h-6 w-6" />}
            label="Protein"
          >
            {sentenceCase(R.protein)}
          </Fact>
          <Fact icon={<GlobeIcon className="h-6 w-6" />} label="Cuisine">
            {sentenceCase(R.cuisine)}
          </Fact>
          <Fact icon={<PlateIcon className="h-6 w-6" />} label="Course">
            {sentenceCase(R.category)}
          </Fact>
          {R.method.length > 0 ? (
            <Fact icon={<OvenIcon className="h-6 w-6" />} label="Method">
              {R.method.map(sentenceCase).join(', ')}
            </Fact>
          ) : null}
          {R.diet.length > 0 ? (
            <Fact icon={<LeafIcon className="h-6 w-6" />} label="Diet">
              {R.diet.join(', ')}
            </Fact>
          ) : null}
        </dl>

        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-[19rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-20">
          <div className="md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:self-start md:overflow-y-auto md:pr-2">
            <IngredientsPanel
              ingredients={R.ingredients}
              cookware={R.cookware}
              servings={R.servings}
            />
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

            {R.notes.length > 0 ? (
              <section className="mt-14 max-w-3xl">
                <Heading variant="h3" className="flex items-center gap-2.5">
                  <NoteIcon className="text-ember h-6 w-6" />
                  Your notes
                </Heading>
                <ul className="mt-4 flex flex-col gap-3">
                  {R.notes.map((note, i) => (
                    <li
                      key={`${i}-${note.text.slice(0, 10)}`}
                      className="rounded-card border-ink/10 border bg-white p-4"
                    >
                      <p className="text-label text-ember font-semibold uppercase">
                        {note.scope === 'general'
                          ? 'Note'
                          : note.scope === 'step'
                            ? `Step ${note.key}`
                            : sentenceCase(note.key)}
                      </p>
                      <p className="mt-1 leading-relaxed">{note.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        {R.keywords.length > 0 ? (
          <div className="border-ink/15 mt-14 flex flex-wrap items-center gap-2 border-t pt-6">
            <span className="text-label text-ink/65 mr-2 font-semibold uppercase">
              Tagged
            </span>
            {R.keywords.slice(0, 10).map((word) => (
              <Tag
                key={word}
                href={`/design/search?q=${encodeURIComponent(word)}`}
              >
                {sentenceCase(word)}
              </Tag>
            ))}
          </div>
        ) : null}
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
