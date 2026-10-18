import Link from 'next/link';

import { ClockIcon, FlameIcon, HeartIcon, PanIcon } from './icons';
import type { SampleRecipe, Tone } from './fixtures';

/** Background and ink for each tone, so tiles stay readable. */
export const TONES: Record<Tone, string> = {
  flame: 'bg-flame text-white',
  marigold: 'bg-marigold text-ink',
  leaf: 'bg-leaf text-ink',
  plum: 'bg-plum text-white',
  bubblegum: 'bg-bubblegum text-ink',
  ink: 'bg-ink text-white',
};

/**
 * A stand-in for a recipe photo: a bold colour block with a big pan. Real
 * photos replace it when there is a cover image.
 */
export function PhotoBlock({
  tone,
  className = '',
}: {
  tone: Tone;
  className?: string;
}) {
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${TONES[tone]} ${className}`}
    >
      <PanIcon className="h-1/3 w-1/3 opacity-30" strokeWidth={1.2} />
    </div>
  );
}

/** A small pill with an icon, used for time and difficulty on cards. */
function Stat({ children, icon }: { children: string; icon: React.ReactNode }) {
  return (
    <span className="font-display inline-flex items-center gap-1.5 text-[11px] tracking-wide uppercase">
      {icon}
      {children}
    </span>
  );
}

/**
 * A recipe card: chunky border, hard offset shadow that "presses" on hover, a
 * heart that is outlined until favourited, and the facts you decide on.
 */
export function RecipeCard({ recipe }: { recipe: SampleRecipe }) {
  return (
    <article className="group relative">
      <Link
        href="/design/recipe"
        className="border-ink block overflow-hidden rounded-2xl border-2 bg-white shadow-[5px_5px_0_0_var(--color-ink)] transition group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[3px_3px_0_0_var(--color-ink)]"
      >
        <PhotoBlock
          tone={recipe.tone}
          className="border-ink aspect-[4/3] border-b-2"
        />
        <div className="p-4">
          <p className="font-display text-flame text-[11px] tracking-[0.18em] uppercase">
            {recipe.cuisine} · {recipe.protein}
          </p>
          <h3 className="font-display mt-1.5 text-xl leading-tight">
            {recipe.title}
          </h3>
          <div className="border-ink/30 mt-3 flex items-center gap-4 border-t-2 border-dotted pt-3">
            <Stat icon={<ClockIcon className="h-4 w-4" />}>
              {recipe.minutes >= 60
                ? `${Math.floor(recipe.minutes / 60)}h ${recipe.minutes % 60 || ''}`.trim()
                : `${recipe.minutes} min`}
            </Stat>
            <Stat icon={<FlameIcon className="h-4 w-4" />}>
              {recipe.difficulty}
            </Stat>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={
          recipe.favourite ? 'Remove from favourites' : 'Add to favourites'
        }
        className={`border-ink absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full border-2 transition ${
          recipe.favourite
            ? 'bg-bubblegum text-ink'
            : 'text-ink bg-white opacity-0 group-hover:opacity-100'
        }`}
      >
        <HeartIcon filled={recipe.favourite} className="h-5 w-5" />
      </button>
    </article>
  );
}
