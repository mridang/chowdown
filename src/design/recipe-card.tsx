import Link from 'next/link';

import { CoverImage } from '@/components/cover-image';

import type { SampleRecipe, Tone } from './fixtures';
import { ClockIcon, FlameIcon, HeartIcon, PanIcon } from './icons';

/**
 * Soft tints for the photo placeholder, so a recipe without a cover still gets
 * a quiet block of colour rather than a loud one.
 */
export const TINTS: Record<Tone, string> = {
  flame: 'bg-flame/15 text-flame',
  marigold: 'bg-marigold/30 text-ink',
  leaf: 'bg-leaf/20 text-ink',
  plum: 'bg-plum/15 text-plum',
  bubblegum: 'bg-bubblegum/30 text-ink',
  ink: 'bg-ink/10 text-ink',
};

/**
 * A stand-in for a recipe photo. With a cover it shows the photo (falling back
 * to the tint if the image fails to load); without one, a soft tinted block.
 */
export function PhotoBlock({
  tone,
  cover,
  className = '',
}: {
  tone: Tone;
  cover?: string;
  className?: string;
}) {
  const tile = (
    <div className={`grid h-full w-full place-items-center ${TINTS[tone]}`}>
      <PanIcon className="h-1/4 w-1/4 opacity-40" strokeWidth={1.1} />
    </div>
  );
  return (
    <div className={`relative overflow-hidden ${className}`}>
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

/** Minutes as "35 min" or "2 h 30". */
export function duration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest}` : `${minutes / 60} h`;
}

/**
 * A recipe card: photo, a small cuisine label, a serif title, and the two facts
 * you decide on. Flat, with a hairline border and a heart that appears on hover
 * (and stays when the recipe is a favourite).
 */
export function RecipeCard({ recipe }: { recipe: SampleRecipe }) {
  return (
    <article className="group relative">
      <Link
        href="/design/recipe"
        className="border-ink/10 group-hover:border-ink/30 block overflow-hidden rounded-lg border bg-white transition"
      >
        <PhotoBlock
          tone={recipe.tone}
          cover={recipe.cover}
          className="aspect-[4/3]"
        />
        <div className="p-4 sm:p-5">
          <p className="text-ember text-[11px] font-semibold tracking-[0.16em] uppercase">
            {recipe.cuisine} · {recipe.protein}
          </p>
          <h3 className="font-display mt-2 text-xl leading-snug font-semibold">
            {recipe.title}
          </h3>
          <div className="text-ink/65 mt-4 flex items-center gap-5 text-[13px]">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              {duration(recipe.minutes)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FlameIcon className="h-4 w-4" />
              {recipe.difficulty}
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={
          recipe.favourite ? 'Remove from favourites' : 'Add to favourites'
        }
        className={`border-ink/10 absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full border bg-white transition ${
          recipe.favourite
            ? 'text-flame'
            : 'text-ink/70 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100'
        }`}
      >
        <HeartIcon filled={recipe.favourite} className="h-[18px] w-[18px]" />
      </button>
    </article>
  );
}
