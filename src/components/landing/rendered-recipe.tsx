import type { ReactElement } from 'react';

import { ClockIcon, ServingsIcon } from '@/components/icons';
import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { WindowFrame } from '@/components/landing/window-frame';
import { Difficulty } from '@/components/ui/difficulty';
import { Eyebrow } from '@/components/ui/layout';
import { TintTile } from '@/components/ui/tint-tile';
import { duration, sentenceCase } from '@/lib/format';

/** The same recipe as the Cooklang file beside it, rendered the way chowdown shows it. */
export function RenderedRecipe({
  recipe,
}: Readonly<{ recipe: SampleRecipe }>): ReactElement {
  return (
    <WindowFrame label={`${recipe.title} in chowdown`}>
      <TintTile tone={recipe.tone} className="aspect-[16/9]" />
      <div className="p-5">
        <Eyebrow>
          {sentenceCase(recipe.cuisine)} · {sentenceCase(recipe.category)}
        </Eyebrow>
        <p className="font-display mt-1.5 line-clamp-2 text-xl leading-tight font-semibold">
          {recipe.title}
        </p>
        <div className="text-muted mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon size="sm" />
            {duration(recipe.minutes)}
          </span>
          <Difficulty level={recipe.difficulty} />
          <span className="inline-flex items-center gap-1.5">
            <ServingsIcon size="sm" />
            Serves {recipe.servings}
          </span>
        </div>
      </div>
    </WindowFrame>
  );
}
