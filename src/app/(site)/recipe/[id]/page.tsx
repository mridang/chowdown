import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache, type ReactNode } from 'react';

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
  ShieldIcon,
} from '@/components/icons';
import { FavouriteButton } from '@/components/favourite-button';
import { RecipeCard, RecipeGrid } from '@/components/recipes/recipe-card';
import { MoreMenu, ShareButton } from '@/components/recipe/actions';
import { CookMode } from '@/components/recipe/cook-mode';
import { HeroPhoto } from '@/components/recipe/hero-photo';
import {
  IngredientsPanel,
  type PanelIngredient,
} from '@/components/recipe/ingredients-panel';
import { Method } from '@/components/recipe/method';
import { RecipeStateProvider } from '@/components/recipe/recipe-state';
import { Tag } from '@/components/ui/chip';
import { Difficulty } from '@/components/ui/difficulty';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import {
  getCurrentUser,
  getSessionUid,
  getUserAccessToken,
} from '@/lib/auth/current-user';
import { getRecipePageRows } from '@/lib/db/recipe-page';
import { setRecipesFolderId } from '@/lib/db/users';
import {
  ensureRecipesFolder,
  getFileContent,
  listRecipeFiles,
} from '@/lib/drive/drive-client';
import { duration, sentenceCase } from '@/lib/format';
import {
  cleanTitle,
  toCardRecipe,
  toneFor,
  type CardRecipe,
  type Tone,
} from '@/lib/recipe/card-data';
import {
  domainOf,
  extractNotes,
  sourceUrlOf,
  type Note,
} from '@/lib/recipe/cook-text';
import { parseRecipe, type ParsedRecipe } from '@/lib/recipe/cooklang';
import { extractMedia, type RecipeMedia } from '@/lib/recipe/media';
import { minutesOf } from '@/lib/recipe/minutes';
import {
  declaredServings,
  extraMetadata,
  groupNotes,
  initialUnits,
  servingsOf,
  type UnitChoice,
} from '@/lib/recipe/page-view';
import { recipeToJsonLd } from '@/lib/recipe/schema-org';
import { parseSimilar } from '@/lib/recipe/similar';
import {
  indexRecipeWrite,
  rowTags,
  type RecipeTags,
} from '@/lib/recipe/tag-index';
import { getDatabase } from '@/lib/util';

import { AddNote } from './_components/add-note';

/** Canonical origin — mirrors `SITE_URL` in the root layout. */
const SITE_URL = 'https://chowdown.apps.mrida.ng';

/** How many "you might also like" recipes the page shows (one full row). */
const ALSO_LIKE_COUNT = 4;

/** What `loadRecipe` resolves to. */
interface RecipePageData {
  recipe: ParsedRecipe;
  notes: Note[];
  favourite: boolean;
  /** The recipe's curated tags, worked out from its source. */
  tags: RecipeTags;
  /** Total time in minutes, when the recipe says. */
  minutes?: number;
  /** The address the recipe was saved from, when it has one. */
  sourceUrl?: string;
  /** A soft colour for the photo tile when there is no photo. */
  tone: Tone;
  /** Where the units switch starts (the user's saved preference, if any). */
  units: UnitChoice;
  /** Similar recipes, best first, ready to render as cards. */
  similar: CardRecipe[];
}

/**
 * Load one recipe for the page — **in a single D1 round trip**, with no Google
 * or Drive call. The user id comes from the signed session cookie (no `users`
 * lookup), and the recipe, favourite flag, precomputed similar list (with the
 * similar recipes' own rows) and the unit preference are fetched together as
 * one batch. D1 sits in one region, so each extra query from the Worker costs a
 * long round trip; collapsing them into one is what keeps the page fast.
 *
 * Only a recipe that isn't in the cache yet (never seen by `/app` or the MCP)
 * falls back to Drive once, and is indexed so the next view is fast.
 *
 * Wrapped in React `cache()` so the page body and `generateMetadata` share one
 * result per request.
 */
const loadRecipe = cache(async (id: string): Promise<RecipePageData | null> => {
  const uid = await getSessionUid();
  if (uid === null) {
    redirect('/');
  }
  const db = getDatabase();

  let rows = await getRecipePageRows(db, uid, id);
  if (!rows.recipe) {
    // Cold cache: read from Drive once and index it, then re-read.
    try {
      const user = await getCurrentUser();
      if (!user) {
        redirect('/');
      }
      const token = await getUserAccessToken(user);
      const folderId =
        user.recipes_folder_id ?? (await ensureRecipesFolder(token));
      if (!user.recipes_folder_id) {
        await setRecipesFolderId(db, user.id, folderId);
      }
      const files = await listRecipeFiles(folderId, token);
      const file = files.find((f) => f.id === id);
      if (!file) {
        return null;
      }
      const source = await getFileContent(file.id, token);
      await indexRecipeWrite(
        db,
        user.id,
        id,
        file.name,
        source,
        file.modifiedTime ?? null,
      );
      rows = await getRecipePageRows(db, uid, id);
    } catch {
      return null;
    }
  }
  if (!rows.recipe) {
    return null;
  }

  const recipe = parseRecipe(rows.recipe.source, rows.recipe.name);
  const time = recipe.metadata.find(([k]) => k.toLowerCase() === 'time')?.[1];

  // The similar list is stored best first; the batch returns its rows in any
  // order, so line them up with the list.
  const similarById = new Map(
    rows.similarRecipes.map((row) => [row.drive_file_id, row]),
  );
  const hearted = new Set(rows.similarFavouriteIds);
  const similar = parseSimilar(rows.similarJson)
    .flatMap((s) => {
      const row = similarById.get(s.id);
      return row ? [toCardRecipe(row, hearted.has(s.id))] : [];
    })
    .slice(0, ALSO_LIKE_COUNT);

  return {
    recipe,
    notes: extractNotes(rows.recipe.source),
    favourite: rows.favourite,
    tags: rowTags(rows.recipe, recipe),
    minutes: minutesOf(time),
    sourceUrl: sourceUrlOf(rows.recipe.source),
    tone: toneFor(id),
    units: initialUnits(rows.units),
    similar,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await loadRecipe(id);
    if (data) {
      return { title: `${data.recipe.title} · chowdown` };
    }
  } catch {
    // Fall through to the default title on any hiccup.
  }
  return { title: 'Recipe · chowdown' };
}

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
  // A definition list may only hold terms and their descriptions, so the icon
  // sits inside the term, positioned to the left of both lines.
  return (
    <div className="relative min-h-11 pl-[3.625rem] leading-tight">
      <dt className="text-label text-ink/65 font-semibold uppercase">
        <span
          aria-hidden="true"
          className="rounded-control bg-sand text-ember absolute top-0 left-0 grid h-11 w-11 place-items-center"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold break-words">{children}</dd>
    </div>
  );
}

/**
 * Where the recipe came from: a link out to the original page with a small
 * "More from" link that lists the other recipes saved from that site. A source
 * that isn't a web address (typed in by hand) is shown as plain text.
 */
function Source({ value, url }: { value?: string; url?: string }) {
  const domain = url ? domainOf(url) : undefined;
  if (url && domain) {
    return (
      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-ink/65">From</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 font-semibold underline underline-offset-4"
        >
          <LinkIcon className="h-4 w-4" />
          {domain}
        </a>
        <Link
          href={`/app?site=${encodeURIComponent(domain)}`}
          className="rounded-control border-ink/25 hover:border-ink inline-flex h-8 items-center border px-2.5 text-xs font-medium transition print:hidden"
        >
          More from {domain}
        </Link>
      </p>
    );
  }
  if (value) {
    return (
      <p className="mt-5 text-sm">
        <span className="text-ink/65">From </span>
        <span className="font-semibold">{value}</span>
      </p>
    );
  }
  return null;
}

/** The first value of a tag, or undefined. */
function first(tags: RecipeTags, key: string): string | undefined {
  return tags[key]?.[0];
}

/**
 * The server-rendered recipe page, laid out like a printed recipe card: a split
 * hero (title, actions and source beside the photo; stacked, photo first, on
 * phones), a grid of the facts the recipe actually has, then the ingredient
 * column (with servings and unit controls) beside the numbered method, then
 * the reader's notes, tags and similar recipes. Content, schema.org JSON-LD and
 * the "you might also like" row all resolve from D1 (the embeddings cache powers
 * similarity with no model call), so the page renders in a single fast pass.
 */
export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadRecipe(id);
  if (!data) {
    notFound();
  }

  const { recipe, tags, similar } = data;
  const jsonLd = recipeToJsonLd(recipe, `${SITE_URL}/recipe/${id}`);
  const media: RecipeMedia = extractMedia(recipe);
  const images = media.cover ? [media.cover, ...media.rest] : [];
  const title = cleanTitle(recipe.title);

  const cuisine = first(tags, 'cuisine');
  const course = first(tags, 'category');
  const protein = first(tags, 'protein');
  const difficulty = first(tags, 'difficulty');
  const eatingStyle = first(tags, 'diet_type');
  const methods = tags['method'] ?? [];
  const diet = tags['diet'] ?? [];
  const keywords = tags['keywords'] ?? [];
  const servings = servingsOf(recipe.metadata);
  const serves = declaredServings(recipe.metadata);
  const sourceText = recipe.metadata.find(
    ([key]) => key.toLowerCase() === 'source',
  )?.[1];
  const extras = extraMetadata(recipe.metadata);

  const hasFacts =
    data.minutes !== undefined ||
    serves !== undefined ||
    difficulty ||
    protein ||
    cuisine ||
    course ||
    methods.length > 0 ||
    diet.length > 0 ||
    eatingStyle;

  // Personal notes go beside the ingredient or step they belong to; the rest
  // (whole-recipe notes and any whose target is gone) are listed below.
  const grouped = groupNotes(
    data.notes,
    recipe.ingredients.map((i) => i.name),
    recipe.steps.length,
  );
  const panelIngredients: PanelIngredient[] = recipe.ingredients.map(
    (ingredient, index) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      notes: grouped.byIngredient[index] ?? [],
    }),
  );
  const cookware = [...new Set(recipe.cookware)];

  return (
    <RecipeStateProvider servings={servings} initialUnits={data.units}>
      {/* Structured data for search engines and recipe scrapers. */}
      <script
        type="application/ld+json"
        // JSON.stringify output is safe to inline; no user-controlled markup.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-ink/10 @container border-b print:border-0">
        {/*
          The text column must start exactly where the page container does, so
          the title, the facts and the ingredients share one left edge. The photo
          bleeds to the right edge, so the container gutter is rebuilt here from
          the section width (cqw) rather than nested.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 print:block">
          <HeroPhoto
            images={images}
            title={title}
            tone={data.tone}
            className="aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[32rem] print:hidden"
          />
          <div className="px-4 py-8 sm:px-6 lg:order-1 lg:py-14 lg:pr-16 lg:pl-[max(2.5rem,calc((100cqw-90rem)/2+2.5rem))]">
            <nav
              className="text-ink/65 text-sm print:hidden"
              aria-label="Breadcrumb"
            >
              <Link
                href="/app"
                className="hover:text-ink inline-flex h-8 items-center hover:underline"
              >
                Recipes
              </Link>
              {cuisine ? (
                <>
                  <span className="mx-1.5" aria-hidden="true">
                    /
                  </span>
                  <Link
                    href={`/app?cuisine=${encodeURIComponent(cuisine)}`}
                    className="hover:text-ink inline-flex h-8 items-center hover:underline"
                  >
                    {sentenceCase(cuisine)}
                  </Link>
                </>
              ) : null}
            </nav>
            {cuisine || course ? (
              <Eyebrow className="mt-5">
                {[cuisine, course]
                  .filter(Boolean)
                  .map((word) => sentenceCase(word!))
                  .join(' · ')}
              </Eyebrow>
            ) : null}
            <Heading as="h1" variant="h1" className="mt-3 lg:text-6xl">
              {title}
            </Heading>
            <Source value={sourceText} url={data.sourceUrl} />
            {media.video ? (
              <a
                href={media.video}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex h-8 items-center gap-1.5 text-sm font-semibold underline underline-offset-4 print:hidden"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch the video
              </a>
            ) : null}
            <div className="mt-7 flex flex-wrap items-center gap-2.5 print:hidden">
              {recipe.steps.length > 0 ? (
                <CookMode title={title} steps={recipe.steps} />
              ) : null}
              <FavouriteButton
                recipeId={id}
                initial={data.favourite}
                variant="labelled"
              />
              <ShareButton title={title} />
              <MoreMenu recipeId={id} title={title} />
            </div>
          </div>
        </div>
      </section>

      <Container>
        {hasFacts ? (
          <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.minutes !== undefined ? (
              <Fact icon={<ClockIcon className="h-6 w-6" />} label="Total time">
                {duration(data.minutes)}
              </Fact>
            ) : null}
            {serves !== undefined ? (
              <Fact icon={<ServingsIcon className="h-6 w-6" />} label="Serves">
                {serves}
              </Fact>
            ) : null}
            {difficulty ? (
              <Fact
                icon={
                  <Difficulty
                    level={difficulty}
                    showLabel={false}
                    className="scale-125"
                  />
                }
                label="Difficulty"
              >
                {difficulty}
              </Fact>
            ) : null}
            {protein ? (
              <Fact
                icon={<ProteinIcon protein={protein} className="h-6 w-6" />}
                label="Protein"
              >
                {sentenceCase(protein)}
              </Fact>
            ) : null}
            {cuisine ? (
              <Fact icon={<GlobeIcon className="h-6 w-6" />} label="Cuisine">
                {sentenceCase(cuisine)}
              </Fact>
            ) : null}
            {course ? (
              <Fact icon={<PlateIcon className="h-6 w-6" />} label="Course">
                {sentenceCase(course)}
              </Fact>
            ) : null}
            {methods.length > 0 ? (
              <Fact icon={<OvenIcon className="h-6 w-6" />} label="Method">
                {methods.map(sentenceCase).join(', ')}
              </Fact>
            ) : null}
            {eatingStyle ? (
              <Fact
                icon={<LeafIcon className="h-6 w-6" />}
                label="Eating style"
              >
                {eatingStyle}
              </Fact>
            ) : null}
            {diet.length > 0 ? (
              <Fact icon={<ShieldIcon className="h-6 w-6" />} label="Diet">
                {diet.join(', ')}
              </Fact>
            ) : null}
          </dl>
        ) : null}

        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-[19rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-20 print:block">
          <div className="md:sticky md:top-28 md:max-h-[calc(100vh-8rem)] md:self-start md:overflow-y-auto md:pr-2 print:static print:max-h-none print:overflow-visible">
            <IngredientsPanel
              ingredients={panelIngredients}
              cookware={cookware}
            />
          </div>

          <div className="print:mt-8">
            <Method steps={recipe.steps} notes={grouped.byStep} />

            <section className="mt-14 max-w-3xl">
              <Heading variant="h3" className="flex items-center gap-2.5">
                <NoteIcon className="text-ember h-6 w-6" />
                Your notes
              </Heading>
              {grouped.general.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-3">
                  {grouped.general.map((note, index) => (
                    <li
                      key={index}
                      className="rounded-card border-ink/10 border bg-white p-4"
                    >
                      {note.label ? (
                        <p className="text-label text-ember font-semibold uppercase">
                          {sentenceCase(note.label)}
                        </p>
                      ) : null}
                      <p className="leading-relaxed">{note.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink/65 mt-3 text-sm print:hidden">
                  Jot down what you changed so you can cook it your way next
                  time. Your notes never change the original recipe.
                </p>
              )}
              <div className="mt-4 print:hidden">
                <AddNote
                  recipeId={id}
                  ingredients={recipe.ingredients.map((i) => i.name)}
                />
              </div>
            </section>
          </div>
        </div>

        {keywords.length > 0 ? (
          <div className="border-ink/15 mt-14 flex flex-wrap items-center gap-2 border-t pt-6 print:hidden">
            <span className="text-label text-ink/65 mr-2 font-semibold uppercase">
              Tagged
            </span>
            {keywords.slice(0, 10).map((word) => (
              <Tag key={word} href={`/app?q=${encodeURIComponent(word)}`}>
                {sentenceCase(word)}
              </Tag>
            ))}
          </div>
        ) : null}

        {extras.length > 0 ? (
          <dl className="text-ink/75 mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {extras.map(([key, value]) => (
              <div key={key} className="flex gap-1.5">
                <dt className="font-semibold capitalize">{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Container>

      {similar.length > 0 ? (
        <Container className="mt-16 print:hidden">
          <Heading>You might also like</Heading>
          <div className="mt-6">
            <RecipeGrid columns={4}>
              {similar.map((card) => (
                <RecipeCard key={card.id} recipe={card} />
              ))}
            </RecipeGrid>
          </div>
        </Container>
      ) : null}
    </RecipeStateProvider>
  );
}
