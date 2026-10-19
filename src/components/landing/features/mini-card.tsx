import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { TintTile } from '@/components/ui/tint-tile';
import { duration } from '@/lib/format';

/**
 * A small recipe card for the mock-ups: the tile, the title and the time. It
 * has the tighter corner of a control, not the card corner, because it sits
 * inside a mock window rather than on the page.
 */
export function MiniCard({ recipe }: { recipe: SampleRecipe }) {
  return (
    <div className="rounded-control border-ink/10 overflow-hidden border bg-white">
      <TintTile tone={recipe.tone} className="aspect-[4/3]" />
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 min-h-[2lh] text-sm leading-snug font-semibold">
          {recipe.title}
        </p>
        <p className="text-subtle mt-1.5 text-xs">
          {duration(recipe.minutes)} · {recipe.difficulty}
        </p>
      </div>
    </div>
  );
}
