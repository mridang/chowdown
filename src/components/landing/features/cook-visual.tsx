import type { ReactElement } from 'react';

import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { NumberBadge } from '@/components/ui/number-badge';

/** Cook mode: a phone showing one large step. */
export function CookVisual({
  recipe,
}: Readonly<{ recipe: SampleRecipe }>): ReactElement {
  return (
    <div className="flex justify-center">
      <div
        role="img"
        aria-label="Cook mode on a phone, showing one large step"
        className="border-field w-[min(21rem,100%)] rounded-[2.25rem] border bg-white p-3"
      >
        <div className="bg-paper rounded-[1.6rem] p-5">
          <p className="text-subtle truncate text-xs font-semibold">
            {recipe.title}
          </p>
          {/* The progress bar, three quarters of the way through the steps. */}
          <div className="bg-ink/10 mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-flame h-full w-3/4 rounded-full" />
          </div>
          <div className="mt-8 flex gap-3">
            <NumberBadge value={3} size="md" />
            <p className="font-display text-[1.65rem] leading-snug font-medium">
              Cover and simmer for 25 minutes, until the chicken pulls apart.
            </p>
          </div>
          <div className="mt-10 flex items-center justify-between">
            <span className="rounded-control border-field inline-flex h-10 items-center border px-4 text-sm font-medium">
              Back
            </span>
            <span className="rounded-control bg-ink inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white">
              Next
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
