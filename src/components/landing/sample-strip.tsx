import type { ReactElement } from 'react';

import { ClockIcon } from '@/components/icons';
import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Container } from '@/components/ui/layout';
import { TintTile } from '@/components/ui/tint-tile';
import { duration } from '@/lib/format';

/** A row of example recipes, drawn as tinted tiles with their facts. */
export function SampleStrip({
  recipes,
}: Readonly<{ recipes: readonly SampleRecipe[] }>): ReactElement {
  return (
    <Container className="pb-4">
      <p className="text-subtle mb-4 text-sm">
        Example recipes, to show how a collection looks.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {recipes.map((recipe, index) => (
          <Card
            as="li"
            key={recipe.id}
            padding="none"
            // Every second card sits lower on wide screens, for a staggered row.
            className={cn('overflow-hidden', index % 2 === 1 && 'lg:mt-8')}
          >
            <TintTile tone={recipe.tone} className="aspect-[4/3]" />
            <div className="p-3">
              <p className="line-clamp-2 min-h-[2lh] text-sm leading-snug font-semibold">
                {recipe.title}
              </p>
              <p className="text-subtle mt-2 flex items-center gap-1.5 text-[13px]">
                <ClockIcon size="compact" />
                {duration(recipe.minutes)}
              </p>
            </div>
          </Card>
        ))}
      </ul>
    </Container>
  );
}
