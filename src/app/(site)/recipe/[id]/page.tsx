import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import {
  IngredientsPanel,
  type PanelIngredient,
} from '@/components/recipe/ingredients-panel';
import { Method } from '@/components/recipe/method';
import { RecipeStateProvider } from '@/components/recipe/recipe-state';
import { STICKY_PANEL_CLASS } from '@/components/site/header-height';
import { Container } from '@/components/ui/layout';
import { cleanTitle } from '@/lib/recipe/card-data';
import { firstTag } from '@/lib/recipe/first-tag';
import { loadRecipe } from '@/lib/recipe/load-recipe';
import { extractMedia } from '@/lib/recipe/media';
import {
  declaredServings,
  extraMetadata,
  groupNotes,
  servingsOf,
} from '@/lib/recipe/page-view';
import { recipeToJsonLd } from '@/lib/recipe/schema-org';
import { jsonLdText } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';

import { AlsoLike } from './_components/also-like';
import { buildFacts, RecipeFacts } from './_components/recipe-facts';
import { authorOf } from './_components/byline';
import { RecipeHero } from './_components/recipe-hero';
import { RecipeExtras } from './_components/recipe-extras';
import { RecipeNotes } from './_components/recipe-notes';
import { RecipeTags } from './_components/recipe-tags';

/**
 * The page's title: the recipe's own, or a plain "Recipe" when it cannot be
 * loaded (a missing recipe gets its own not-found page, and a hiccup in the
 * store should not break the tab title).
 */
export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>): Promise<Metadata> {
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

/**
 * The server-rendered recipe page, laid out like a printed recipe card: a split
 * hero (title, actions and source beside the photo; stacked, photo first, on
 * phones), a grid of the facts the recipe actually has, then the ingredient
 * column (with servings and unit controls) beside the numbered method, then
 * the reader's notes, tags and similar recipes. Content, schema.org JSON-LD and
 * the "you might also like" row all resolve from D1 (the embeddings cache powers
 * similarity with no model call), so the page renders in a single fast pass.
 *
 * This file only loads the data and composes the sections; each section lives
 * in `_components/`.
 */
export default async function RecipePage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>): Promise<ReactElement> {
  const { id } = await params;
  const data = await loadRecipe(id);
  if (!data) {
    notFound();
  }

  const { recipe, tags, similar } = data;
  // Cached for the request (the header reads the same value), so this is no extra work.
  const jsonLd = recipeToJsonLd(recipe, `${SITE_URL}/recipe/${id}`);
  const media = extractMedia(recipe);
  const images = media.cover ? [media.cover, ...media.rest] : [];
  const title = cleanTitle(recipe.title);

  const sourceText = recipe.metadata.find(
    ([key]) => key.toLowerCase() === 'source',
  )?.[1];
  const facts = buildFacts({
    minutes: data.minutes,
    serves: declaredServings(recipe.metadata),
    tags,
  });

  // Personal notes go beside the ingredient or step they belong to; the rest
  // (whole-recipe notes and any whose target is gone) are listed below.
  const ingredientNames = recipe.ingredients.map((i) => i.name);
  const grouped = groupNotes(data.notes, ingredientNames, recipe.steps.length);
  const panelIngredients: readonly PanelIngredient[] = recipe.ingredients.map(
    (ingredient, index) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      notes: grouped.byIngredient[index] ?? [],
    }),
  );
  const cookware = [...new Set(recipe.cookware)];

  return (
    <RecipeStateProvider
      servings={servingsOf(recipe.metadata)}
      initialUnits={data.units}
    >
      {/* Structured data for search engines and recipe scrapers. */}
      <script
        type="application/ld+json"
        // Recipe text comes from files and imports, so `<` is escaped: a
        // "</script>" in a title must not be able to end this tag.
        dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }}
      />

      <RecipeHero
        recipeId={id}
        title={title}
        images={images}
        tone={data.tone}
        cuisine={firstTag(tags, 'cuisine')}
        course={firstTag(tags, 'category')}
        sourceText={sourceText}
        sourceUrl={data.sourceUrl}
        author={authorOf(recipe.metadata)}
        video={media.video}
        steps={recipe.steps}
        favourite={data.favourite}
      />

      <Container>
        <RecipeFacts facts={facts} />

        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-[19rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-20 print:block">
          <div
            className={`${STICKY_PANEL_CLASS} md:self-start md:overflow-y-auto md:pr-2 print:static print:max-h-none print:overflow-visible`}
          >
            <IngredientsPanel
              ingredients={panelIngredients}
              cookware={cookware}
            />
          </div>

          <div className="print:mt-8">
            <Method steps={recipe.steps} notes={grouped.byStep} />
            <RecipeNotes
              recipeId={id}
              general={grouped.general}
              ingredients={ingredientNames}
            />
          </div>
        </div>

        <RecipeTags keywords={tags['keywords'] ?? []} />
        <RecipeExtras extras={extraMetadata(recipe.metadata)} />
      </Container>

      <AlsoLike recipes={similar} />
    </RecipeStateProvider>
  );
}
