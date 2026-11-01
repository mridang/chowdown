import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { ClockIcon, FlameIcon, ProteinIcon } from '@/components/icons';
import { CardFact } from '@/components/recipes/card-fact';
import { FavouriteBadge } from '@/components/recipes/favourite-badge';
import { FavouriteButton } from '@/components/recipes/favourite-button';
import { PhotoBlock } from '@/components/recipes/recipe-card';
import { Heading } from '@/components/ui/layout';
import { duration, sentenceCase } from '@/utils/text';
import type { CardRecipe } from '@/domain/recipe/card-data';

/**
 * How a row in a long list is left unpainted until it is near the screen, for
 * the reason (and with the safeguards) described for the grid's cards in
 * `recipe-card.tsx`: the shell's padding keeps the focus ring inside the part
 * that is painted. A row is a thumbnail and a few lines of text, so the guess
 * for its height before it is first seen is 7rem.
 */
const SKIP_WHEN_OFFSCREEN =
  '-m-1.5 p-1.5 [content-visibility:auto] [contain-intrinsic-block-size:auto_7rem]';

/** Where the heart sits on a row: the right edge, halfway down. */
const HEART_POSITION = 'absolute top-1/2 right-3 -translate-y-1/2';

/**
 * How wide a row's thumbnail is laid out: 6rem on a phone, 9rem from 640px
 * (see the width classes on the photo below).
 */
const THUMB_SIZES = '(min-width: 640px) 144px, 96px';

/**
 * A recipe as one row of a list: a small photo, then the title with its
 * cuisine, source site and facts beside it, and the heart at the end. The
 * whole row is one link. Facts a recipe lacks are left out, as on a card, and
 * long titles and sites are cut off rather than pushing the row wider.
 *
 * Rows below the fold are not painted until they scroll near (see
 * {@link SKIP_WHEN_OFFSCREEN}); the `priority` ones are painted at once.
 *
 * The heart is decorative unless `live` is set, as on {@link RecipeCard}.
 */
export function RecipeRow({
  recipe,
  live = false,
  priority = false,
  headingLevel = 'h3',
}: Readonly<{
  recipe: CardRecipe;
  live?: boolean;
  /** The row is above the fold: load its photo eagerly. */
  priority?: boolean;
  /** The title's heading level: one below the heading it sits under. */
  headingLevel?: 'h2' | 'h3';
}>): ReactElement {
  return (
    <div className={priority ? undefined : SKIP_WHEN_OFFSCREEN}>
      <article className="group relative">
        <Link
          // A demo row goes nowhere, so it fetches nothing.
          prefetch={live ? null : false}
          href={`/recipe/${recipe.id}`}
          // Room on the right for the heart, which is laid over the row.
          className="focus-ring flex items-center gap-4 overflow-hidden rounded-card border border-line bg-white p-3 pr-14 transition group-hover:border-ink/30"
        >
          <PhotoBlock
            tone={recipe.tone}
            cover={recipe.cover}
            priority={priority}
            sizes={THUMB_SIZES}
            className="aspect-4/3 w-24 shrink-0 rounded-control sm:w-36"
          />
          <div className="min-w-0 flex-1">
            {recipe.cuisine ? (
              <p className="truncate text-[10px] leading-4 font-semibold tracking-[0.14em] text-ember uppercase">
                {sentenceCase(recipe.cuisine)}
              </p>
            ) : null}
            <Heading
              as={headingLevel}
              variant="h4"
              className="line-clamp-2 text-[1.0625rem] leading-snug"
            >
              {recipe.uncurated ? <IdeaTag /> : null}
              {recipe.title}
            </Heading>
            {recipe.site ? (
              <p className="mt-0.5 truncate text-sm text-muted">
                {recipe.site}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {recipe.minutes !== undefined ? (
                <CardFact icon={<ClockIcon size="sm" />}>
                  {duration(recipe.minutes)}
                </CardFact>
              ) : null}
              {recipe.difficulty ? (
                <CardFact icon={<FlameIcon size="sm" />}>
                  {recipe.difficulty}
                </CardFact>
              ) : null}
              {recipe.protein ? (
                <CardFact
                  icon={<ProteinIcon size="sm" protein={recipe.protein} />}
                >
                  {sentenceCase(recipe.protein)}
                </CardFact>
              ) : null}
            </div>
          </div>
        </Link>
        {live ? (
          <FavouriteButton
            recipeId={recipe.id}
            initial={recipe.favourite}
            variant="overlay"
            className={HEART_POSITION}
          />
        ) : (
          <FavouriteBadge on={recipe.favourite} className={HEART_POSITION} />
        )}
      </article>
    </div>
  );
}

/** The marker in front of a bare idea's title, as on a card. */
function IdeaTag(): ReactElement {
  return (
    <span className="mr-2 inline-block rounded-full border border-line bg-white px-2 py-px align-middle text-[10px] font-semibold tracking-[0.14em] uppercase">
      Idea
    </span>
  );
}

/** The stack of recipe rows a list lives in. */
export function RecipeRows({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return <div className="flex flex-col gap-3">{children}</div>;
}
