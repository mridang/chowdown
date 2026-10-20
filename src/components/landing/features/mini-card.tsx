import type { ReactElement } from 'react';

import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { TintTile } from '@/components/ui/tint-tile';
import { duration } from '@/lib/format';

/**
 * A small recipe card for the mock-ups: the tile, the title and the time. It
 * has the tighter corner of a control, not the card corner, because it sits
 * inside a mock window rather than on the page.
 */
export function MiniCard({
  recipe,
}: Readonly<{ recipe: SampleRecipe }>): ReactElement {
  return (
    <div className="overflow-hidden rounded-control border border-line bg-white">
      <TintTile tone={recipe.tone} className="aspect-4/3" />
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 min-h-[2lh] text-sm leading-snug font-semibold">
          {recipe.title}
        </p>
        <p className="mt-1.5 text-xs text-subtle">
          {duration(recipe.minutes)} · {recipe.difficulty}
        </p>
      </div>
    </div>
  );
}
