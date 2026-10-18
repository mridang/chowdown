import Link from 'next/link';
import type { ReactNode } from 'react';

import { CoverImage } from '@/components/cover-image';

import type { SampleRecipe, Tone } from '@/components/landing/demo-recipes';
import { duration, sentenceCase } from '@/lib/format';
import { ClockIcon, FlameIcon, HeartIcon, PanIcon, ProteinIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import { Heading } from '@/components/ui/layout';

/**
 * Soft tints for the photo placeholder, so a recipe without a cover still gets
 * a quiet block of colour rather than a loud one.
 */
const TINTS: Record<Tone, string> = {
  flame: 'bg-flame/15 text-flame',
  marigold: 'bg-marigold/30 text-ink',
  forest: 'bg-forest/15 text-forest',
  sand: 'bg-sand text-ink/70',
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
}: {
  tone: Tone;
  cover?: string;
  className?: string;
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
          fallback={tile}
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
    <span className="text-ink/65 inline-flex items-center gap-1.5 text-[13px]">
      {icon}
      {children}
    </span>
  );
}

/**
 * A recipe card. Every card in a grid is the same height: the photo is a fixed
 * ratio, the title reserves two lines, and the facts sit on the bottom edge.
 */
export function RecipeCard({ recipe }: { recipe: SampleRecipe }) {
  return (
    <article className="group relative h-full">
      <Link
        href={`/recipe/${recipe.id}`}
        className="rounded-card border-ink/10 group-hover:border-ink/30 flex h-full flex-col overflow-hidden border bg-white transition"
      >
        <PhotoBlock
          tone={recipe.tone}
          cover={recipe.cover}
          className="aspect-[4/3] w-full shrink-0"
        />
        <div className="flex flex-1 flex-col p-4">
          <p className="text-ember truncate text-[10px] font-semibold tracking-[0.14em] uppercase">
            {sentenceCase(recipe.cuisine)}
          </p>
          <Heading
            as="h3"
            variant="h4"
            className="mt-1.5 line-clamp-2 min-h-[2lh] text-[1.0625rem] leading-snug"
          >
            {recipe.title}
          </Heading>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3.5">
            <Fact icon={<ClockIcon className="h-4 w-4" />}>
              {duration(recipe.minutes)}
            </Fact>
            <Fact icon={<FlameIcon className="h-4 w-4" />}>
              {recipe.difficulty}
            </Fact>
            <Fact
              icon={
                <ProteinIcon protein={recipe.protein} className="h-4 w-4" />
              }
            >
              {sentenceCase(recipe.protein)}
            </Fact>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={
          recipe.favourite ? 'Remove from favourites' : 'Add to favourites'
        }
        className={cn(
          'absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white transition',
          'focus-visible:opacity-100',
          recipe.favourite
            ? 'text-flame'
            : 'text-ink/70 hover:text-flame md:opacity-0 md:group-hover:opacity-100',
        )}
      >
        <HeartIcon filled={recipe.favourite} className="h-[18px] w-[18px]" />
      </button>
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
