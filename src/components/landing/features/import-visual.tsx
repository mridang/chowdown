import type { ReactElement } from 'react';

import { fileSlug } from '@/components/landing/cook-file';
import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { WindowFrame } from '@/components/landing/window-frame';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/layout';
import { TintTile } from '@/components/ui/tint-tile';
import { sentenceCase } from '@/utils/text';

/** Importing: a pasted link becomes a draft with tags. */
export function ImportVisual({
  recipe,
}: Readonly<{ recipe: SampleRecipe }>): ReactElement {
  return (
    <WindowFrame label="Pasting a link to import a recipe" title="Add recipes">
      <div className="p-5 sm:p-6">
        <p className="text-sm font-semibold">Paste links or text</p>
        <div className="mt-2 rounded-control border border-field bg-paper p-3 font-mono text-xs break-all text-muted">
          https://{recipe.site}/{fileSlug(recipe.title)}
        </div>
        <Card padding="xs" className="mt-5 flex items-center gap-4">
          <TintTile
            tone={recipe.tone}
            className="size-20 shrink-0 rounded-control"
          />
          <div className="min-w-0">
            <Eyebrow>Draft ready to review</Eyebrow>
            <p className="mt-1 line-clamp-2 font-display text-lg leading-tight font-semibold">
              {recipe.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[recipe.cuisine, recipe.protein, recipe.difficulty].map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium"
                  >
                    {sentenceCase(tag)}
                  </span>
                ),
              )}
            </div>
          </div>
        </Card>
      </div>
    </WindowFrame>
  );
}
