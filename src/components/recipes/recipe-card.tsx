import type { ReactElement, ReactNode } from 'react';

import { CoverImage } from '@/components/cover-image';
import { IntentLink } from '@/components/ui/intent-link';

import { ClockIcon, FlameIcon, ProteinIcon } from '@/components/icons';
import { CardFact } from '@/components/recipes/card-fact';
import { FavouriteBadge } from '@/components/recipes/favourite-badge';
import { FavouriteButton } from '@/components/recipes/favourite-button';
import { cn } from '@/components/ui/cn';
import { Heading } from '@/components/ui/layout';
import { TintTile } from '@/components/ui/tint-tile';
import { duration, sentenceCase } from '@/utils/text';
import type { CardRecipe, Tone } from '@/domain/recipe/card-data';

/**
 * A recipe photo. With a cover it shows the photo (falling back to the tint if
 * the image fails to load); without one, a soft tinted block. The caller sets
 * the shape with `className` (an aspect ratio or a height).
 */
export function PhotoBlock({
  tone,
  cover,
  className,
  priority,
}: Readonly<{
  tone: Tone;
  cover?: string;
  className?: string;
  /** The photo is above the fold, so load it straight away. */
  priority?: boolean;
}>): ReactElement {
  // A recipe without a cover still gets a quiet block of colour.
  const tile = <TintTile tone={tone} className="size-full" />;
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {cover ? (
        <CoverImage
          src={cover}
          // The photo box is 4:3; stating it keeps the layout still while the
          // photo loads.
          width={640}
          height={480}
          // The grid has one column, then two, then three (four on very wide
          // screens) and the container stops growing at 90rem. Browsers that
          // cannot measure the laid-out image (`sizes="auto"`) read this.
          sizes="(min-width: 1700px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          fallback={tile}
          priority={priority}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0">{tile}</div>
      )}
    </div>
  );
}

/**
 * How a card in a long grid is left unpainted until it is near the screen
 * (`content-visibility: auto`): a library of hundreds of recipes would otherwise
 * lay out and paint every card on arrival, though a phone shows four.
 *
 * `auto` is what makes this safe: the skipped card stays in the accessibility
 * tree, still takes keyboard focus, still turns up in the browser's find, and
 * the browser remembers its real height once seen so the scrollbar and scroll
 * anchoring do not jump. Only the height needs a guess before the first paint
 * (the width comes from the grid). Setting only the block size matters: an
 * inline size would count toward the width of an automatically sized column.
 *
 * The guess comes from measuring the grid in Chrome at widths from 320px to
 * 1800px. On a phone there is one column, so a card is a 4:3 photo as wide as
 * the page less its 1rem margins, plus 8.5rem of text, which matches the
 * measured 351px at 320 and 392px at 375 exactly. From 640px the columns hold
 * the width to a narrow range and the measured heights are 19.4rem to 24.2rem,
 * so 22rem.
 *
 * Skipping paints nothing outside the box, which would cut off the focus ring
 * that stands 4px off the card. So the card sits inside a shell with that much
 * padding, pulled back out by the same amount in margin so the layout is
 * exactly what it was; the ring then falls inside the part that is painted.
 */
const SKIP_WHEN_OFFSCREEN = [
  '-m-1.5 p-1.5 [content-visibility:auto]',
  '[contain-intrinsic-block-size:auto_calc((100vw_-_2rem)*0.75_+_8.5rem)]',
  'sm:[contain-intrinsic-block-size:auto_22rem]',
].join(' ');

/** Where the heart sits on a card: the top-right corner of the photo. */
const HEART_POSITION = 'absolute top-3 right-3';

/**
 * A recipe card. Every card in a grid is the same height: the photo is a fixed
 * ratio, the title reserves two lines, and the facts sit on the bottom edge.
 * Facts a recipe lacks (a time, a difficulty, a protein) are left out rather
 * than shown as a blank or a zero.
 *
 * Cards below the fold are not painted until they scroll near (see
 * {@link SKIP_WHEN_OFFSCREEN}); the `priority` ones are painted at once.
 *
 * The heart is decorative unless `live` is set, which wires it to the real
 * favourites API; the landing page's demo cards leave it off.
 */
export function RecipeCard({
  recipe,
  live = false,
  priority = false,
  headingLevel = 'h3',
}: Readonly<{
  recipe: CardRecipe;
  live?: boolean;
  /** The card is above the fold: load its photo eagerly. */
  priority?: boolean;
  /** The card title's heading level: one below the heading it sits under. */
  headingLevel?: 'h2' | 'h3';
}>): ReactElement {
  // A recipe typed in by hand has no cuisine; its source site is the next best
  // line to show, and a bare idea has neither.
  const kicker = recipe.cuisine || recipe.site;
  return (
    <div className={priority ? undefined : SKIP_WHEN_OFFSCREEN}>
      <article className="group relative h-full">
        <IntentLink
          // Live cards fetch their page as soon as it is wanted; the landing
          // page's demo cards go nowhere, so they fetch nothing.
          enabled={live}
          eager={priority}
          href={`/recipe/${recipe.id}`}
          className="focus-ring flex h-full flex-col overflow-hidden rounded-card border border-line bg-white transition group-hover:border-ink/30"
        >
          <PhotoBlock
            tone={recipe.tone}
            cover={recipe.cover}
            priority={priority}
            className="aspect-4/3 w-full shrink-0"
          />
          <div className="flex flex-1 flex-col p-4">
            <p className="h-4 truncate text-[10px] leading-4 font-semibold tracking-[0.14em] text-ember uppercase">
              {kicker ? sentenceCase(kicker) : null}
            </p>
            <Heading
              as={headingLevel}
              variant="h4"
              className="mt-1.5 line-clamp-2 min-h-[2lh] text-[1.0625rem] leading-snug"
            >
              {recipe.title}
            </Heading>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3.5">
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
        </IntentLink>
        {recipe.uncurated ? (
          <span className="absolute top-3 left-3 rounded-full border border-line bg-white px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-ink uppercase">
            Idea
          </span>
        ) : null}
        {live ? (
          <FavouriteButton
            recipeId={recipe.id}
            initial={recipe.favourite}
            variant="overlay"
            className={HEART_POSITION}
          />
        ) : (
          // A demo card's heart is only decoration: it is not a control, so it is
          // neither focusable nor announced.
          <FavouriteBadge on={recipe.favourite} className={HEART_POSITION} />
        )}
      </article>
    </div>
  );
}

/** The responsive grid recipe cards live in. */
export function RecipeGrid({
  children,
  columns = 3,
}: Readonly<{
  children: ReactNode;
  columns?: 3 | 4;
}>): ReactElement {
  return (
    <div
      className={cn(
        'grid gap-5 sm:grid-cols-2 sm:gap-6',
        columns === 4
          ? 'lg:grid-cols-4'
          : 'min-[1700px]:grid-cols-4 xl:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}
