import type { ReactNode } from 'react';

import { CoverImage } from '@/components/cover-image';
import { IntentLink } from '@/components/ui/intent-link';

import {
  ClockIcon,
  FlameIcon,
  HeartIcon,
  PanIcon,
  ProteinIcon,
} from '@/components/icons';
import { CardHeart } from '@/components/recipes/card-heart';
import { cn } from '@/components/ui/cn';
import { Heading } from '@/components/ui/layout';
import { duration, sentenceCase } from '@/lib/format';
import type { CardRecipe, Tone } from '@/lib/recipe/card-data';

/**
 * Soft tints for the photo placeholder, so a recipe without a cover still gets
 * a quiet block of colour rather than a loud one.
 */
const TINTS: Record<Tone, string> = {
  flame: 'bg-flame/15 text-flame',
  marigold: 'bg-marigold/30 text-ink',
  forest: 'bg-forest/15 text-forest',
  sand: 'bg-sand text-muted',
  ink: 'bg-ink/10 text-ink',
};

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
}: {
  tone: Tone;
  cover?: string;
  className?: string;
  /** The photo is above the fold, so load it straight away. */
  priority?: boolean;
}) {
  const tile = (
    <div className={cn('grid h-full w-full place-items-center', TINTS[tone])}>
      <PanIcon className="h-1/4 w-1/4 opacity-40" strokeWidth={1.1} />
    </div>
  );
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {cover ? (
        <CoverImage
          src={cover}
          // The photo box is 4:3; stating it keeps the layout still while the
          // photo loads.
          width={640}
          height={480}
          fallback={tile}
          priority={priority}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0">{tile}</div>
      )}
    </div>
  );
}

/** An icon with a short value, used for the facts on a card. */
function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="text-subtle inline-flex items-center gap-1.5 text-[13px]">
      {icon}
      {children}
    </span>
  );
}

/**
 * A recipe card. Every card in a grid is the same height: the photo is a fixed
 * ratio, the title reserves two lines, and the facts sit on the bottom edge.
 * Facts a recipe lacks (a time, a difficulty, a protein) are left out rather
 * than shown as a blank or a zero.
 *
 * The heart is decorative unless `live` is set, which wires it to the real
 * favourites API; the landing page's demo cards leave it off.
 */
export function RecipeCard({
  recipe,
  live = false,
  priority = false,
  headingLevel = 'h3',
}: {
  recipe: CardRecipe;
  live?: boolean;
  /** The card is above the fold: load its photo eagerly. */
  priority?: boolean;
  /** The card title's heading level: one below the heading it sits under. */
  headingLevel?: 'h2' | 'h3';
}) {
  // A recipe typed in by hand has no cuisine; its source site is the next best
  // line to show, and a bare idea has neither.
  const kicker = recipe.cuisine || recipe.site;
  const heartLabel = recipe.favourite
    ? 'Remove from favourites'
    : 'Add to favourites';
  return (
    <article className="group relative h-full">
      <IntentLink
        // Live cards fetch their page as soon as it is wanted; the landing
        // page's demo cards go nowhere, so they fetch nothing.
        enabled={live}
        eager={priority}
        href={`/recipe/${recipe.id}`}
        className="rounded-card border-ink/10 group-hover:border-ink/30 flex h-full flex-col overflow-hidden border bg-white transition focus-ring"
      >
        <PhotoBlock
          tone={recipe.tone}
          cover={recipe.cover}
          priority={priority}
          className="aspect-[4/3] w-full shrink-0"
        />
        <div className="flex flex-1 flex-col p-4">
          <p className="text-ember h-4 truncate text-[10px] leading-4 font-semibold tracking-[0.14em] uppercase">
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
              <Fact icon={<ClockIcon size="sm" />}>
                {duration(recipe.minutes)}
              </Fact>
            ) : null}
            {recipe.difficulty ? (
              <Fact icon={<FlameIcon size="sm" />}>{recipe.difficulty}</Fact>
            ) : null}
            {recipe.protein ? (
              <Fact icon={<ProteinIcon size="sm" protein={recipe.protein} />}>
                {sentenceCase(recipe.protein)}
              </Fact>
            ) : null}
          </div>
        </div>
      </IntentLink>
      {recipe.uncurated ? (
        <span className="border-ink/15 text-ink absolute top-3 left-3 rounded-full border bg-white px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
          Idea
        </span>
      ) : null}
      {live ? (
        <CardHeart recipeId={recipe.id} initial={recipe.favourite} />
      ) : (
        <button
          type="button"
          aria-label={heartLabel}
          className={cn(
            'border-ink/10 absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full border bg-white transition',
            'focus-visible:opacity-100',
            recipe.favourite
              ? 'text-ember'
              : 'text-muted hover:text-ember [@media(hover:hover)]:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
          )}
        >
          <HeartIcon size="menu" filled={recipe.favourite} />
        </button>
      )}
    </article>
  );
}

/** The responsive grid recipe cards live in. */
export function RecipeGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        'grid gap-5 sm:grid-cols-2 sm:gap-6',
        columns === 4
          ? 'lg:grid-cols-4'
          : 'xl:grid-cols-3 min-[1700px]:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}
