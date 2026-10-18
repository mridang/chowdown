import type { ReactNode } from 'react';

import type { SampleRecipe, Tone } from '@/components/landing/demo-recipes';
import {
  fileSlug,
  previewLines,
  tidyLine,
} from '@/components/landing/cook-file';
import {
  ClockIcon,
  GoogleIcon,
  PanIcon,
  PlugIcon,
  ServingsIcon,
} from '@/components/icons';
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
import { duration, sentenceCase } from '@/lib/format';

/**
 * The landing page is a public, static page, so everything on it is drawn from
 * the made-up recipes in `demo-recipes.ts`: no saved recipe of anyone's, no
 * photo from another site, and no client script apart from the FAQ accordion.
 */

/** The Google sign-in button used throughout the landing page. */
export function SignInButton({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <ButtonLink href="/api/auth/login" size={size}>
      <GoogleIcon className="h-5 w-5" />
      Continue with Google
    </ButtonLink>
  );
}

/**
 * Soft tints for a recipe's picture, so a sample recipe gets a quiet block of
 * colour rather than a photo.
 */
const TINTS: Record<Tone, string> = {
  flame: 'bg-flame/15 text-flame',
  marigold: 'bg-marigold/30 text-ink',
  forest: 'bg-forest/15 text-forest',
  sand: 'bg-sand text-ink/70',
  ink: 'bg-ink/10 text-ink',
};

/** A recipe's stand-in picture: a tinted block with a pan. The caller sets the shape. */
function Tile({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('grid place-items-center', TINTS[tone], className)}
    >
      <PanIcon className="h-1/4 w-1/4 opacity-40" strokeWidth={1.1} />
    </div>
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
        'rounded-card border-ink/15 overflow-hidden border bg-white',
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

/** The first lines of a recipe's Cooklang file, as a text editor shows them. */
function CookFile({
  recipe,
  lines = 11,
}: {
  recipe: SampleRecipe;
  lines?: number;
}) {
  return (
    <Window
      label="A recipe as a plain text file"
      title={`${fileSlug(recipe.title, 28)}.cook`}
    >
      <pre className="overflow-hidden p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap sm:p-5">
        {previewLines(recipe.cooklang ?? '', lines).map((line, i) => (
          <span key={i} className="block">
            <CookLine line={tidyLine(line)} />
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
      <Tile tone={recipe.tone} className="aspect-[16/9]" />
      <div className="p-5">
        <p className="text-label text-ember font-semibold uppercase">
          {sentenceCase(recipe.cuisine)} · {sentenceCase(recipe.category)}
        </p>
        <p className="font-display mt-1.5 line-clamp-2 text-xl leading-tight font-semibold">
          {recipe.title}
        </p>
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
      <div className="sm:relative sm:z-10 sm:-mr-4">
        <CookFile recipe={recipe} />
      </div>
      <div className="sm:translate-y-10">
        <RenderedRecipe recipe={recipe} />
      </div>
    </div>
  );
}

/** A row of example recipes, drawn as tinted tiles with their facts. */
export function SampleStrip({ recipes }: { recipes: SampleRecipe[] }) {
  return (
    <Container className="pb-4">
      <p className="text-ink/65 mb-4 text-sm">
        Example recipes, to show how a collection looks.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {recipes.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              'rounded-card border-ink/10 overflow-hidden border bg-white',
              i % 2 === 1 && 'lg:mt-8',
            )}
          >
            <Tile tone={r.tone} className="aspect-[4/3]" />
            <div className="p-3">
              <p className="line-clamp-2 min-h-[2lh] text-sm leading-snug font-semibold">
                {r.title}
              </p>
              <p className="text-ink/65 mt-2 flex items-center gap-1.5 text-[13px]">
                <ClockIcon className="h-3.5 w-3.5" />
                {duration(r.minutes)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Container>
  );
}

/** Three plain facts about how the product keeps your recipes. */
export function Facts() {
  const figures: [string, string][] = [
    ['1 folder', 'in your Google Drive holds every recipe'],
    ['.cook', 'plain text that any editor can open'],
    ['0 ads', 'and your recipes are never sold or shared'],
  ];
  return (
    <Container className="py-16 sm:py-20">
      <dl className="border-ink/15 grid grid-cols-1 gap-8 border-y py-10 text-center sm:grid-cols-3">
        {figures.map(([value, label]) => (
          <div key={value}>
            <dt className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {value}
            </dt>
            <dd className="text-ink/70 mt-2">{label}</dd>
          </div>
        ))}
      </dl>
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

/** A small recipe card for the mock-ups: the tile, the title and the time. */
function MiniCard({ recipe }: { recipe: SampleRecipe }) {
  return (
    <div className="rounded-control border-ink/10 overflow-hidden border bg-white">
      <Tile tone={recipe.tone} className="aspect-[4/3]" />
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 min-h-[2lh] text-sm leading-snug font-semibold">
          {recipe.title}
        </p>
        <p className="text-ink/65 mt-1.5 text-xs">
          {duration(recipe.minutes)} · {recipe.difficulty}
        </p>
      </div>
    </div>
  );
}

/** Your Drive: the folder of files, and one open. */
function FilesVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const files = recipes.slice(0, 6);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.9fr_1.1fr]">
      <Window
        label="A Google Drive folder of recipe files"
        title="Drive / Recipes"
      >
        <ul className="p-2">
          {files.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                'rounded-control flex items-center gap-3 px-3 py-2.5',
                i === 0 && 'bg-marigold/25',
              )}
            >
              <Tile
                tone={r.tone}
                className="h-8 w-8 shrink-0 rounded-[6px] [&>svg]:h-1/2 [&>svg]:w-1/2"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {fileSlug(r.title)}.cook
              </span>
            </li>
          ))}
        </ul>
      </Window>
      <CookFile recipe={files[0]!} lines={9} />
    </div>
  );
}

/** Importing: a pasted link becomes a draft with tags. */
function ImportVisual({ recipe }: { recipe: SampleRecipe }) {
  return (
    <Window label="Pasting a link to import a recipe" title="Add recipes">
      <div className="p-5 sm:p-6">
        <p className="text-sm font-semibold">Paste links or text</p>
        <div className="rounded-control border-ink/20 bg-paper text-ink/75 mt-2 border p-3 font-mono text-xs break-all">
          https://{recipe.site}/{fileSlug(recipe.title)}
        </div>
        <div className="rounded-card border-ink/10 mt-5 flex items-center gap-4 border p-3">
          <Tile
            tone={recipe.tone}
            className="rounded-control h-20 w-20 shrink-0"
          />
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

/** One filter option in the mock-up: a box, a name and how many recipes match. */
function Option({
  label,
  count,
  on,
}: {
  label: string;
  count: number;
  on?: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border',
          on ? 'border-ink bg-ink text-white' : 'border-ink/30 bg-white',
        )}
      >
        {on ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M2.5 6.5 5 9l4.5-5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        ) : null}
      </span>
      <span className={on ? 'font-semibold' : undefined}>{label}</span>
      <span className="text-ink/65 ml-auto text-xs">{count}</span>
    </li>
  );
}

/** Filtering: a filter panel next to the recipes it leaves. */
function FiltersVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const count = (test: (r: SampleRecipe) => boolean) =>
    recipes.filter(test).length;
  const results = recipes.filter(
    (r) => r.difficulty === 'Easy' && r.minutes <= 30,
  );
  return (
    <Window label="Filtering recipes by difficulty and time" title="Recipes">
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-[13rem_1fr] sm:p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-label text-ink/65 font-semibold uppercase">
              Difficulty
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              <Option
                on
                label="Easy"
                count={count((r) => r.difficulty === 'Easy')}
              />
              <Option
                label="Medium"
                count={count((r) => r.difficulty === 'Medium')}
              />
              <Option
                label="Hard"
                count={count((r) => r.difficulty === 'Hard')}
              />
            </ul>
          </div>
          <div>
            <p className="text-label text-ink/65 font-semibold uppercase">
              Time
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              <Option
                label="Up to 15 min"
                count={count((r) => r.minutes <= 15)}
              />
              <Option
                on
                label="16–30 min"
                count={count((r) => r.minutes > 15 && r.minutes <= 30)}
              />
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-2 content-start gap-4">
          {results.slice(0, 2).map((r) => (
            <MiniCard key={r.id} recipe={r} />
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
            <div className="bg-flame h-full w-3/4 rounded-full" />
          </div>
          <div className="mt-8 flex gap-3">
            <span className="bg-flame text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full font-semibold">
              3
            </span>
            <p className="font-display text-[1.65rem] leading-snug font-medium">
              Cover and simmer for 25 minutes, until the chicken pulls apart.
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

/** The assistant: a chat that answers from your own recipes. */
function AiVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const picks = recipes
    .filter((r) => r.protein === 'chicken' && r.minutes <= 40)
    .slice(0, 2);
  return (
    <Window
      label="A chat where an assistant suggests recipes from your collection"
      title="Your assistant"
    >
      <div className="p-5 sm:p-6">
        <div className="rounded-card bg-ink ml-auto w-fit max-w-[85%] rounded-br-sm px-4 py-3 text-sm text-white">
          What can I make with chicken in under 40 minutes?
        </div>
        <div className="mt-4 max-w-[92%]">
          <p className="text-sm leading-relaxed">
            {picks.length === 2 ? 'Two' : String(picks.length)} from your
            collection fit. Both take under 40 minutes:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {picks.map((r) => (
              <MiniCard key={r.id} recipe={r} />
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
  const importer =
    recipes.find((r) => r.site === 'seriouseats.com') ?? recipes[0]!;
  const cook = recipes.find((r) => r.cooklang) ?? recipes[0]!;
  return (
    <Section id="features" surface="white">
      <Container className="flex flex-col gap-24 sm:gap-32">
        <Feature
          eyebrow="Yours to keep"
          title="Plain text, in your own Drive"
          body="Every recipe is a small readable file in a folder only you control. Open it in any editor, back it up, or take it elsewhere. There is nothing to export because nothing is locked in."
        >
          <FilesVisual recipes={recipes} />
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
          title="Narrow it down in a click or two"
          body="Filter by difficulty, time, protein, cuisine and diet, and keep your favourites close. Easy and quick is two clicks away."
        >
          <FiltersVisual recipes={recipes} />
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
          <AiVisual recipes={recipes} />
        </Feature>
      </Container>
    </Section>
  );
}

const FAQ: [string, string][] = [
  [
    'Is chowdown free?',
    'Yes. chowdown is free to use, and your recipes live in your own Google Drive.',
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
    'Any assistant that supports MCP connectors, including ChatGPT and Claude. You add one address, sign in with Google and approve what the assistant may do.',
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
        <Accordion className="border-ink/10 border-t">
          {FAQ.map(([question, answer]) => (
            <AccordionItem key={question} name="faq">
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
            Sign in with Google and add your first recipe.
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
