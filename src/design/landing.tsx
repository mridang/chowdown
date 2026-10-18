import Link from 'next/link';
import type { ReactNode } from 'react';

import type { SampleRecipe } from './fixtures';
import { duration, sentenceCase } from './format';
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  FolderIcon,
  GoogleIcon,
  LinkIcon,
  PlugIcon,
  ProteinIcon,
  ServingsIcon,
  ShieldIcon,
  SlidersIcon,
  SparkIcon,
  ExpandIcon,
} from './icons';
import { PhotoBlock } from './recipe-card';
import { MCP_URL } from './site-footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { ButtonLink } from './ui/button';
import { Difficulty } from './ui/difficulty';
import { Container, Eyebrow, Heading, Section } from './ui/layout';

/** The Google sign-in button used throughout the landing page. */
export function SignInButton({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <ButtonLink href="/design/home?user=1" size={size}>
      <GoogleIcon className="h-5 w-5" />
      Continue with Google
    </ButtonLink>
  );
}

/** A window frame with three dots, so a mock-up reads as a piece of the product. */
function Window({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="rounded-card border-ink/15 overflow-hidden border bg-white"
    >
      <div className="border-ink/10 bg-sand flex items-center gap-1.5 border-b px-4 py-2.5">
        <span className="bg-ink/20 h-2.5 w-2.5 rounded-full" />
        <span className="bg-ink/20 h-2.5 w-2.5 rounded-full" />
        <span className="bg-ink/20 h-2.5 w-2.5 rounded-full" />
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

/** The hero's picture of the product: one recipe, as the app shows it. */
export function HeroMock({ recipe }: { recipe: SampleRecipe }) {
  return (
    <Window label={`The ${recipe.title} recipe page in chowdown`}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1.1fr]">
        <PhotoBlock
          tone={recipe.tone}
          cover={recipe.cover}
          className="rounded-control aspect-[4/3] sm:aspect-auto sm:min-h-64"
        />
        <div className="flex flex-col">
          <p className="text-label text-ember font-semibold uppercase">
            {sentenceCase(recipe.cuisine)} · {sentenceCase(recipe.category)}
          </p>
          <h3 className="font-display mt-2 line-clamp-3 text-2xl leading-tight font-semibold">
            {recipe.title}
          </h3>
          <div className="text-ink/75 mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              {duration(recipe.minutes)}
            </span>
            <Difficulty level={recipe.difficulty} />
            <span className="inline-flex items-center gap-1.5">
              <ServingsIcon className="h-4 w-4" />
              Serves {recipe.servings}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ProteinIcon protein={recipe.protein} className="h-4 w-4" />
              {sentenceCase(recipe.protein)}
            </span>
          </div>
          <div className="mt-auto flex gap-2 pt-5">
            <span className="rounded-control bg-flame text-ink inline-flex h-9 items-center gap-2 px-3.5 text-sm font-semibold">
              <ExpandIcon className="h-4 w-4" />
              Cook mode
            </span>
            <span className="rounded-control border-ink/25 inline-flex h-9 items-center border px-3.5 text-sm font-medium">
              Metric · US
            </span>
          </div>
        </div>
      </div>
    </Window>
  );
}

/** A feature row: text on one side, a mock-up on the other (swapped with `flip`). */
function Feature({
  icon,
  eyebrow,
  title,
  body,
  points,
  flip,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? 'lg:order-2' : undefined}>
        <span className="rounded-control bg-sand text-ember grid h-11 w-11 place-items-center">
          {icon}
        </span>
        <Eyebrow className="mt-5">{eyebrow}</Eyebrow>
        <Heading className="mt-2">{title}</Heading>
        <p className="text-ink/75 mt-4 max-w-lg text-lg leading-relaxed">
          {body}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <CheckIcon className="text-live mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-ink/85">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'lg:order-1' : undefined}>{children}</div>
    </div>
  );
}

/** A row in the "your Drive" file list mock. */
function FileRow({ name }: { name: string }) {
  return (
    <li className="rounded-control hover:bg-ink/5 flex items-center gap-3 px-3 py-2.5">
      <FolderIcon className="text-ink/55 h-4 w-4" />
      <span className="font-mono text-sm">{name}</span>
      <span className="text-ink/65 ml-auto text-xs">.cook</span>
    </li>
  );
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

/** The product's main selling points, each with a small mock-up. */
export function Features({ recipes }: { recipes: SampleRecipe[] }) {
  const files = recipes.slice(0, 5);
  const easy = recipes.filter((r) => r.difficulty === 'Easy').slice(0, 2);
  const step = recipes.find((r) => r.cooklang && r.cover) ?? recipes[0]!;
  return (
    <Section id="features" surface="white">
      <Container className="flex flex-col gap-20 sm:gap-28">
        <Feature
          icon={<FolderIcon className="h-6 w-6" />}
          eyebrow="Yours to keep"
          title="Plain text files in your own Drive"
          body="Every recipe is a small, readable file in a folder only you control. There is no lock-in: open it in any editor, move it, back it up, or take it elsewhere."
          points={[
            'Written in Cooklang, an open recipe format',
            'chowdown only touches files it created',
            'Leave any time and keep everything',
          ]}
        >
          <Window label="A Google Drive folder of recipe files">
            <p className="text-sm font-semibold">My Drive / Recipes</p>
            <ul className="divide-ink/10 mt-3 divide-y">
              {files.map((r) => (
                <FileRow key={r.id} name={slug(r.title)} />
              ))}
            </ul>
          </Window>
        </Feature>

        <Feature
          flip
          icon={<LinkIcon className="h-6 w-6" />}
          eyebrow="Save from anywhere"
          title="Paste a link and it becomes a recipe"
          body="Drop in a web address, a block of text or a whole list of links. chowdown reads each page, tidies it into a clean recipe, tags it and shows you a draft before anything is saved."
          points={[
            'Works with most recipe sites',
            'Review and edit every draft first',
            'Duplicates are caught for you',
          ]}
        >
          <Window label="Pasting a link to import a recipe">
            <div className="rounded-control border-ink/20 bg-paper text-ink/75 border p-3 font-mono text-sm break-all">
              https://www.example.com/recipes/
              {slug(files[0]?.title ?? 'dinner')}
            </div>
            <div className="text-ink/65 mt-3 flex items-center gap-2 text-sm">
              <SparkIcon className="text-ember h-4 w-4" />
              Reading the page and tidying it up…
            </div>
            <div className="rounded-card border-ink/10 mt-4 border p-4">
              <p className="text-label text-ember font-semibold uppercase">
                Draft
              </p>
              <p className="font-display mt-1 text-lg font-semibold">
                {files[0]?.title}
              </p>
              <p className="text-ink/65 mt-1 text-sm">
                {files[0]?.cuisine} · {files[0]?.difficulty} ·{' '}
                {duration(files[0]?.minutes ?? 30)}
              </p>
            </div>
          </Window>
        </Feature>

        <Feature
          icon={<SlidersIcon className="h-6 w-6" />}
          eyebrow="Find dinner fast"
          title="Filter by what actually matters"
          body="Narrow your collection by difficulty, time, protein, cuisine, diet and more, or just describe what you feel like and let search do the rest."
          points={[
            'Easy, medium and hard, so you pick your effort',
            'Up to 15, 30 or 60 minutes',
            'Every filter collapses to keep things tidy',
          ]}
        >
          <Window label="The recipe filters">
            <p className="text-sm font-semibold">Difficulty</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['Easy', 'Medium', 'Hard'].map((level, i) => (
                <span
                  key={level}
                  className={
                    i === 0
                      ? 'rounded-control border-ink bg-ink inline-flex h-9 items-center border px-3 text-sm font-medium text-white'
                      : 'rounded-control border-ink/25 inline-flex h-9 items-center border bg-white px-3 text-sm'
                  }
                >
                  <Difficulty level={level} onDark={i === 0} />
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm font-semibold">Time</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['Up to 15 min', '16–30 min', '31–60 min'].map((label, i) => (
                <span
                  key={label}
                  className={
                    i === 1
                      ? 'rounded-control border-ink bg-ink inline-flex h-9 items-center border px-3 text-sm font-medium text-white'
                      : 'rounded-control border-ink/25 inline-flex h-9 items-center border bg-white px-3 text-sm'
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {easy.map((r) => (
                <div
                  key={r.id}
                  className="rounded-control border-ink/10 overflow-hidden border"
                >
                  <PhotoBlock
                    tone={r.tone}
                    cover={r.cover}
                    className="aspect-[4/3]"
                  />
                  <p className="line-clamp-1 px-3 py-2 text-sm font-medium">
                    {r.title}
                  </p>
                </div>
              ))}
            </div>
          </Window>
        </Feature>

        <Feature
          flip
          icon={<ExpandIcon className="h-6 w-6" />}
          eyebrow="Made for the stove"
          title="Cook mode and the units you use"
          body="Switch to a full-screen view with one big step at a time, with your screen kept awake. Scale the servings and flip between metric and US measures as you go."
          points={[
            'Large, clear steps you can read from across the kitchen',
            'Tick ingredients off as they go in',
            'Servings and units change every amount',
          ]}
        >
          <Window label="Cook mode showing one large step">
            <div className="bg-ink/10 h-1.5 overflow-hidden rounded-full">
              <div className="bg-flame h-full w-1/3 rounded-full" />
            </div>
            <div className="mt-5 flex gap-4">
              <span className="bg-flame text-ink grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-semibold">
                2
              </span>
              <p className="font-display text-2xl leading-snug font-medium">
                {step.cooklang
                  ? 'Add the chicken and cook until it turns opaque.'
                  : 'Add the chicken.'}
              </p>
            </div>
            <div className="rounded-control border-ink/20 mt-6 inline-flex border p-0.5 text-sm">
              <span className="bg-ink rounded-[6px] px-3 py-1 text-white">
                Metric
              </span>
              <span className="text-ink/75 px-3 py-1">US</span>
            </div>
          </Window>
        </Feature>

        <Feature
          icon={<PlugIcon className="h-6 w-6" />}
          eyebrow="Bring your own AI"
          title="Ask ChatGPT or Claude about your recipes"
          body="Add one address to your assistant. It can search your collection, suggest dinner from what you have saved and file new recipes for you. You sign in and approve, with no keys to copy."
          points={[
            'Open standard (MCP), works across assistants',
            'Read-only or full access, your choice',
            'Disconnect any time',
          ]}
        >
          <Window label="A chat where an assistant suggests recipes from your collection">
            <div className="rounded-card bg-ink ml-auto max-w-[85%] rounded-br-sm px-4 py-3 text-sm text-white">
              What can I make with chicken in half an hour?
            </div>
            <div className="rounded-card bg-sand mt-3 max-w-[90%] rounded-bl-sm px-4 py-3 text-sm">
              <p>From your recipes, these take 30 minutes or less:</p>
              <ul className="mt-2 flex flex-col gap-1.5 font-medium">
                {recipes
                  .filter((r) => r.protein === 'chicken' && r.minutes <= 30)
                  .slice(0, 2)
                  .map((r) => (
                    <li key={r.id}>• {r.title}</li>
                  ))}
              </ul>
            </div>
            <p className="rounded-control border-ink/15 bg-paper text-ink/65 mt-4 truncate border px-3 py-2 font-mono text-xs">
              {MCP_URL}
            </p>
          </Window>
        </Feature>
      </Container>
    </Section>
  );
}

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Sign in with Google',
    body: 'One click. chowdown creates a Recipes folder in your Drive and only ever touches files it made.',
  },
  {
    n: '02',
    title: 'Add your recipes',
    body: 'Paste links or text, or write one by hand. Each becomes a tidy, tagged file.',
  },
  {
    n: '03',
    title: 'Cook and connect',
    body: 'Filter, scale, switch units, go full-screen at the stove, and ask your AI for ideas.',
  },
];

/** Three steps from sign-in to cooking. */
export function HowItWorks() {
  return (
    <Section id="how" surface="ink">
      <Container>
        <Eyebrow className="text-marigold">How it works</Eyebrow>
        <Heading className="mt-2 max-w-xl">Three steps, no lock-in</Heading>
        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step) => (
            <div key={step.n} className="border-t border-white/25 pt-6">
              <span className="font-display text-marigold text-5xl font-semibold italic">
                {step.n}
              </span>
              <Heading as="h3" variant="h3" className="mt-4">
                {step.title}
              </Heading>
              <p className="mt-2 max-w-sm leading-relaxed text-white/75">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** What chowdown does and does not touch. */
export function Trust() {
  const items: [ReactNode, string, string][] = [
    [
      <ShieldIcon key="s" className="h-6 w-6" />,
      'Narrow access',
      'chowdown can only see the files it created in your Drive, nothing else.',
    ],
    [
      <FolderIcon key="f" className="h-6 w-6" />,
      'Your files, your folder',
      'Delete the folder and your recipes are gone. Move it and they come with you.',
    ],
    [
      <PlugIcon key="p" className="h-6 w-6" />,
      'You approve every app',
      'Assistants ask first, can be read-only, and can be disconnected any time.',
    ],
  ];
  return (
    <Section surface="page">
      <Container>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {items.map(([icon, title, body]) => (
            <div key={title} className="flex gap-4">
              <span className="rounded-control bg-sand text-ember grid h-11 w-11 shrink-0 place-items-center">
                {icon}
              </span>
              <div>
                <Heading as="h3" variant="h4">
                  {title}
                </Heading>
                <p className="text-ink/75 mt-1.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
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
    'Where are my recipes stored?',
    'In a Recipes folder in your Google Drive, as small plain-text files in the open Cooklang format. You can open them in any text editor.',
  ],
  [
    'What can chowdown see in my Drive?',
    'Only the files it creates. It uses the narrow Drive permission that cannot read anything else you have stored there.',
  ],
  [
    'What if I want to leave?',
    'Delete chowdown from your Google account settings. Your Recipes folder and every file in it stay exactly where they are.',
  ],
  [
    'Which AI assistants work with it?',
    'Any assistant that supports MCP connectors, including ChatGPT and Claude. You add one address, sign in and choose read-only or full access.',
  ],
  [
    'Can I import recipes from websites?',
    'Yes. Paste a link or a list of links and chowdown turns each page into a draft you can review before saving.',
  ],
];

/** Common questions, as collapsible answers. */
export function Faq() {
  return (
    <Section id="faq" surface="white">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <Heading className="mt-2">Good to know</Heading>
          <p className="text-ink/75 mt-4 max-w-sm">
            Short answers about where your recipes live and who can see them.
          </p>
        </div>
        <Accordion
          type="single"
          collapsible
          defaultValue="item-0"
          className="border-ink/10 border-t"
        >
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

/** Small reassurance under the hero buttons. */
export function TrustLine() {
  const items = [
    'Free to use',
    'Files stay in your Drive',
    'Works with ChatGPT and Claude',
  ];
  return (
    <ul className="text-ink/75 mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <CheckIcon className="text-live h-4 w-4" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** A link styled as a quiet arrow link. */
export function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
    >
      {children} <ArrowIcon className="h-4 w-4" />
    </Link>
  );
}
