import Link from 'next/link';
import type { ReactNode } from 'react';

import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { duration, sentenceCase } from '@/lib/format';
import { ClockIcon, GoogleIcon, PlugIcon, ServingsIcon } from '@/components/icons';
import { PhotoBlock, RecipeCard } from '@/components/recipes/recipe-card';
import { FilterPanel } from '@/components/recipes/filter-panel';
import { buildFacets, parseQuery } from '@/components/recipes/search-query';
import { MCP_URL } from '@/components/site/site-footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Difficulty } from '@/components/ui/difficulty';
import { Container, Eyebrow, Heading, Section } from '@/components/ui/layout';

/** The Google sign-in button used throughout the landing page. */
export function SignInButton({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <ButtonLink href="/api/auth/login" size={size}>
      <GoogleIcon className="h-5 w-5" />
      Continue with Google
    </ButtonLink>
  );
}

/** A window frame, so a mock-up reads as a real piece of the product. */
function Window({
  children,
  label,
  title,
  className,
}: {
  children: ReactNode;
  label: string;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'overflow-hidden rounded-card border border-ink/15 bg-white',
        className,
      )}
    >
      <div className="border-ink/10 bg-sand flex items-center gap-1.5 border-b px-4 py-2.5">
        <span className="bg-ink/20 h-2.5 w-2.5 rounded-full" />
        <span className="bg-ink/20 h-2.5 w-2.5 rounded-full" />
        <span className="bg-ink/20 h-2.5 w-2.5 rounded-full" />
        {title ? (
          <span className="text-ink/65 ml-3 truncate font-mono text-xs">
            {title}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** One line of a Cooklang file, with its parts coloured. */
function CookLine({ line }: { line: string }) {
  if (line.startsWith('>>')) {
    const [key, ...rest] = line.slice(2).split(':');
    return (
      <>
        <span className="text-ink/65">{'>> '}</span>
        <span className="text-ember">{key?.trim()}</span>
        <span className="text-ink/65">: </span>
        <span>{rest.join(':').trim()}</span>
      </>
    );
  }
  const parts = line.split(
    /(@[^{@#~]+\{[^}]*\}|#[^{@#~]+\{[^}]*\}|~\{[^}]*\})/g,
  );
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="bg-marigold/40 rounded px-0.5 font-medium">
            {part}
          </span>
        ) : part.startsWith('#') || part.startsWith('~') ? (
          <span
            key={i}
            className="bg-forest/15 text-forest rounded px-0.5 font-medium"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Shorten a long line and show metadata units ("15%minutes") the way a person writes them. */
function tidy(line: string): string {
  const clean = line.startsWith('>>') ? line.replace('%', ' ') : line;
  return clean.length > 92 ? `${clean.slice(0, 90)}…` : clean;
}

/** The first lines of a recipe's Cooklang file, as a text editor shows them. */
function CookFile({
  recipe,
  lines = 11,
}: {
  recipe: SampleRecipe;
  lines?: number;
}) {
  const text = (recipe.cooklang ?? '')
    .split('\n')
    .filter(
      (l) =>
        l.trim() &&
        !l.startsWith('>> images') &&
        !l.startsWith('>> keywords') &&
        !l.startsWith('>> favourite'),
    )
    .slice(0, lines);
  return (
    <Window
      label="A recipe as a plain text file"
      title={`${recipe.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 28)}.cook`}
    >
      <pre className="overflow-hidden p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap sm:p-5">
        {text.map((line, i) => (
          <span key={i} className="block">
            <CookLine line={tidy(line)} />
          </span>
        ))}
      </pre>
    </Window>
  );
}

/** The same recipe, rendered the way chowdown shows it. */
function RenderedRecipe({ recipe }: { recipe: SampleRecipe }) {
  return (
    <Window label={`${recipe.title} in chowdown`}>
      <PhotoBlock
        tone={recipe.tone}
        cover={recipe.cover}
        className="aspect-[16/9]"
      />
      <div className="p-5">
        <p className="text-label text-ember font-semibold uppercase">
          {sentenceCase(recipe.cuisine)} · {sentenceCase(recipe.category)}
        </p>
        <h3 className="font-display mt-1.5 line-clamp-2 text-xl leading-tight font-semibold">
          {recipe.title}
        </h3>
        <div className="text-ink/75 mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4" />
            {duration(recipe.minutes)}
          </span>
          <Difficulty level={recipe.difficulty} />
          <span className="inline-flex items-center gap-1.5">
            <ServingsIcon className="h-4 w-4" />
            Serves {recipe.servings}
          </span>
        </div>
      </div>
    </Window>
  );
}

/**
 * The hero picture: the plain text file on one side and the finished recipe it
 * becomes on the other, which shows the whole idea of the product at a glance.
 */
export function HeroVisual({ recipe }: { recipe: SampleRecipe }) {
  return (
    <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_1fr] sm:items-center sm:gap-0">
      <div className="sm:relative sm:z-10 sm:-mr-8">
        <CookFile recipe={recipe} />
      </div>
      <div className="sm:translate-y-10">
        <RenderedRecipe recipe={recipe} />
      </div>
    </div>
  );
}

/** A strip of real recipe photos, each linking to its recipe. */
export function PhotoStrip({ recipes }: { recipes: SampleRecipe[] }) {
  return (
    <Container className="pb-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {recipes.map((r, i) => (
          <Link
            key={r.id}
            href={`/recipe/${r.id}`}
            className={cn(
              'group relative block overflow-hidden rounded-card',
              i % 2 === 0 ? 'aspect-[4/5]' : 'aspect-[4/5] lg:mt-8',
            )}
          >
            <PhotoBlock
              tone={r.tone}
              cover={r.cover}
              className="h-full w-full transition duration-500 group-hover:scale-[1.03]"
            />
            <span className="from-ink/75 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-3 pt-10 text-sm font-medium text-white">
              <span className="line-clamp-2">{r.title}</span>
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}

/** Three honest numbers about a real collection. */
export function Numbers({ recipes }: { recipes: SampleRecipe[] }) {
  const figures: [string, string][] = [
    [String(recipes.length), 'recipes in one place'],
    [String(new Set(recipes.map((r) => r.cuisine)).size), 'cuisines'],
    [String(new Set(recipes.map((r) => r.site)).size), 'sites they came from'],
  ];
  return (
    <Container className="py-16 sm:py-20">
      <dl className="border-ink/15 grid grid-cols-1 gap-8 border-y py-10 text-center sm:grid-cols-3">
        {figures.map(([value, label]) => (
          <div key={label}>
            <dt className="sr-only">{label}</dt>
            <dd>
              <span className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                {value}
              </span>
              <span className="text-ink/70 mt-1 block">{label}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-ink/65 mx-auto mt-6 max-w-lg text-center text-sm">
        The numbers from one real collection, built by pasting links over a few
        evenings.
      </p>
    </Container>
  );
}

/** A feature: a heading, a short paragraph and one picture. No lists. */
function Feature({
  eyebrow,
  title,
  body,
  flip,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <div className={flip ? 'lg:order-2' : undefined}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading className="mt-3">{title}</Heading>
        <p className="text-ink/75 mt-5 max-w-md text-lg leading-relaxed">
          {body}
        </p>
      </div>
      <div className={flip ? 'lg:order-1' : undefined}>{children}</div>
    </div>
  );
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

/** Your Drive: the folder of files, and one open. */
function FilesVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const files = recipes.slice(0, 6);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.9fr_1.1fr]">
      <Window
        label="A Google Drive folder of recipe files"
        title="Drive / Recipes"
      >
        <ul className="divide-ink/10 divide-y p-2">
          {files.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                'flex items-center gap-3 rounded-control px-3 py-2.5',
                i === 0 && 'bg-marigold/25',
              )}
            >
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded-[6px]">
                <PhotoBlock
                  tone={r.tone}
                  cover={r.cover}
                  className="h-full w-full"
                />
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {slug(r.title)}.cook
              </span>
            </li>
          ))}
        </ul>
      </Window>
      <CookFile recipe={files[0]!} lines={9} />
    </div>
  );
}

/** Importing: a pasted link becomes a draft with a photo and tags. */
function ImportVisual({ recipe }: { recipe: SampleRecipe }) {
  return (
    <Window label="Pasting a link to import a recipe" title="Add recipes">
      <div className="p-5 sm:p-6">
        <p className="text-sm font-semibold">Paste links or text</p>
        <div className="rounded-control border-ink/20 bg-paper text-ink/75 mt-2 border p-3 font-mono text-xs break-all">
          https://{recipe.site}/{slug(recipe.title)}
        </div>
        <div className="rounded-card border-ink/10 mt-5 flex items-center gap-4 border p-3">
          <span className="rounded-control h-20 w-20 shrink-0 overflow-hidden">
            <PhotoBlock
              tone={recipe.tone}
              cover={recipe.cover}
              className="h-full w-full"
            />
          </span>
          <div className="min-w-0">
            <p className="text-label text-ember font-semibold uppercase">
              Draft ready to review
            </p>
            <p className="font-display mt-1 line-clamp-2 text-lg leading-tight font-semibold">
              {recipe.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[recipe.cuisine, recipe.protein, recipe.difficulty].map(
                (tag) => (
                  <span
                    key={tag}
                    className="bg-sand rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {sentenceCase(tag)}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </Window>
  );
}

/** Filtering: the real filter panel next to real results. */
function FiltersVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const query = parseQuery({ difficulty: 'Easy', time: '15,30' });
  const facets = buildFacets(recipes, query).filter((f) =>
    ['difficulty', 'time'].includes(f.key),
  );
  const results = recipes
    .filter((r) => r.difficulty === 'Easy' && r.minutes <= 30 && r.cover)
    .slice(0, 2);
  return (
    <Window label="Filtering recipes by difficulty and time" title="Recipes">
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-[13rem_1fr] sm:p-6">
        <div className="pointer-events-none">
          <FilterPanel facets={facets} />
        </div>
        <div className="grid grid-cols-2 content-start gap-4">
          {results.map((r) => (
            <div key={r.id} className="pointer-events-none">
              <RecipeCard recipe={r} />
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}

/** Cook mode: a phone showing one large step. */
function CookVisual({ recipe }: { recipe: SampleRecipe }) {
  return (
    <div className="flex justify-center">
      <div
        role="img"
        aria-label="Cook mode on a phone, showing one large step"
        className="border-ink/20 w-[min(21rem,100%)] rounded-[2.25rem] border bg-white p-3"
      >
        <div className="bg-paper rounded-[1.6rem] p-5">
          <p className="text-ink/65 truncate text-xs font-semibold">
            {recipe.title}
          </p>
          <div className="bg-ink/10 mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-flame h-full w-2/5 rounded-full" />
          </div>
          <div className="mt-8 flex gap-3">
            <span className="bg-flame text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full font-semibold">
              2
            </span>
            <p className="font-display text-[1.65rem] leading-snug font-medium">
              Add the chicken and cook until it turns opaque.
            </p>
          </div>
          <div className="mt-10 flex items-center justify-between">
            <span className="rounded-control border-ink/25 inline-flex h-10 items-center border px-4 text-sm font-medium">
              Back
            </span>
            <span className="rounded-control bg-ink inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white">
              Next
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The assistant: a chat that answers from your own recipes, with photos. */
function AiVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const picks = recipes
    .filter((r) => r.protein === 'chicken' && r.minutes <= 30 && r.cover)
    .slice(0, 2);
  return (
    <Window
      label="A chat where an assistant suggests recipes from your collection"
      title="ChatGPT"
    >
      <div className="p-5 sm:p-6">
        <div className="rounded-card bg-ink ml-auto w-fit max-w-[85%] rounded-br-sm px-4 py-3 text-sm text-white">
          What can I make with chicken in half an hour?
        </div>
        <div className="mt-4 max-w-[92%]">
          <p className="text-sm leading-relaxed">
            Two from your collection fit. Both are under 30 minutes:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {picks.map((r) => (
              <div
                key={r.id}
                className="rounded-control border-ink/10 overflow-hidden border"
              >
                <PhotoBlock
                  tone={r.tone}
                  cover={r.cover}
                  className="aspect-[4/3]"
                />
                <p className="line-clamp-2 px-3 py-2 text-sm font-medium">
                  {r.title}
                </p>
              </div>
            ))}
          </div>
          <p className="rounded-control bg-sand text-ink/70 mt-4 flex items-center gap-2 truncate px-3 py-2 font-mono text-xs">
            <PlugIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{MCP_URL}</span>
          </p>
        </div>
      </div>
    </Window>
  );
}

/** The product's selling points, one picture each. */
export function Features({ recipes }: { recipes: SampleRecipe[] }) {
  const withPhoto = recipes.filter((r) => r.cover && r.cooklang);
  const importer =
    withPhoto.find((r) => r.site === 'seriouseats.com') ?? withPhoto[4]!;
  const cook = withPhoto.find((r) => r.protein === 'chicken') ?? withPhoto[0]!;
  return (
    <Section id="features" surface="white">
      <Container className="flex flex-col gap-24 sm:gap-32">
        <Feature
          eyebrow="Yours to keep"
          title="Plain text, in your own Drive"
          body="Every recipe is a small readable file in a folder only you control. Open it in any editor, back it up, or take it elsewhere. There is nothing to export because nothing is locked in."
        >
          <FilesVisual recipes={withPhoto} />
        </Feature>
        <Feature
          flip
          eyebrow="Save from anywhere"
          title="Paste a link, get a recipe"
          body="Drop in a web address or a whole list of them. chowdown reads each page, tidies it up and tags it, and you check the draft before anything is saved."
        >
          <ImportVisual recipe={importer} />
        </Feature>
        <Feature
          eyebrow="Find dinner fast"
          title="Filter by what you feel like doing"
          body="Narrow by difficulty, time, protein, cuisine and diet, or just describe the evening. Easy and quick is two clicks away."
        >
          <FiltersVisual recipes={withPhoto} />
        </Feature>
        <Feature
          flip
          eyebrow="At the stove"
          title="Big steps, your units"
          body="Cook mode shows one large step at a time and keeps the screen awake. Scale the servings and switch between metric and US without doing sums."
        >
          <CookVisual recipe={cook} />
        </Feature>
        <Feature
          eyebrow="Bring your own AI"
          title="Ask your assistant about your recipes"
          body="Add one address to ChatGPT or Claude. It searches your collection, suggests dinner from what you have saved and files new recipes for you."
        >
          <AiVisual recipes={withPhoto} />
        </Feature>
      </Container>
    </Section>
  );
}

const FAQ: [string, string][] = [
  [
    'Is chowdown free?',
    'Yes. Your recipes live in your own Google Drive, so there is nothing for us to store or charge for.',
  ],
  [
    'What can chowdown see in my Drive?',
    'Only the files it creates. It uses the narrow Drive permission that cannot read anything else you have stored there.',
  ],
  [
    'What if I want to leave?',
    'Remove chowdown in your Google account settings. Your Recipes folder and every file in it stay exactly where they are.',
  ],
  [
    'Which AI assistants work with it?',
    'Any assistant that supports MCP connectors, including ChatGPT and Claude. You add one address, sign in and choose read-only or full access.',
  ],
];

/** Common questions, as collapsible answers. */
export function Faq() {
  return (
    <Section id="faq" surface="page">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <Heading className="mt-3">Good to know</Heading>
        </div>
        <Accordion type="single" collapsible className="border-ink/10 border-t">
          {FAQ.map(([question, answer], i) => (
            <AccordionItem key={question} value={`item-${i}`}>
              <AccordionTrigger className="py-1 text-lg font-semibold">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-ink/75 max-w-2xl leading-relaxed">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  );
}

/** The closing call to action. */
export function FinalCta() {
  return (
    <section className="bg-marigold">
      <Container className="flex flex-col items-start justify-between gap-6 py-14 sm:py-16 md:flex-row md:items-center">
        <div>
          <Heading>Start your collection today</Heading>
          <p className="text-ink/80 mt-2 text-lg">
            Sign in with Google. Your first recipe is a minute away.
          </p>
        </div>
        <SignInButton />
      </Container>
    </section>
  );
}

/** A quiet note under the hero buttons about who it works with. */
export function WorksWith() {
  return (
    <p className="text-ink/70 mt-5 flex flex-wrap items-center gap-2 text-sm">
      Works with Google Drive, ChatGPT and Claude.
    </p>
  );
}
