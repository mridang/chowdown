import type { ReactNode } from 'react';

import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { MiniCard } from '@/components/landing/features/mini-card';
import { WindowFrame } from '@/components/landing/window-frame';
import { cn } from '@/components/ui/cn';
import { Eyebrow } from '@/components/ui/layout';

/** One filter option in the mock-up: a box, a name and how many recipes match. */
function FilterOption({
  label,
  count,
  on,
}: {
  label: string;
  count: number;
  /** Whether the option is ticked. */
  on?: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border',
          on ? 'border-ink bg-ink text-white' : 'border-ink/30 bg-white',
        )}
      >
        {on ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M2.5 6.5 5 9l4.5-5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        ) : null}
      </span>
      <span className={on ? 'font-semibold' : undefined}>{label}</span>
      <span className="text-subtle ml-auto text-xs">{count}</span>
    </li>
  );
}

/** A titled list of filter options in the mock-up's side panel. */
function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Eyebrow tone="subtle">{title}</Eyebrow>
      <ul className="mt-3 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

/** Filtering: a filter panel next to the recipes it leaves. */
export function FiltersVisual({ recipes }: { recipes: SampleRecipe[] }) {
  const count = (test: (recipe: SampleRecipe) => boolean) =>
    recipes.filter(test).length;
  // The two ticked options (Easy, 16-30 min) decide which recipes are shown.
  const results = recipes.filter(
    (recipe) => recipe.difficulty === 'Easy' && recipe.minutes <= 30,
  );
  return (
    <WindowFrame
      label="Filtering recipes by difficulty and time"
      title="Recipes"
    >
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-[13rem_1fr] sm:p-6">
        <div className="flex flex-col gap-5">
          <FilterGroup title="Difficulty">
            <FilterOption
              on
              label="Easy"
              count={count((recipe) => recipe.difficulty === 'Easy')}
            />
            <FilterOption
              label="Medium"
              count={count((recipe) => recipe.difficulty === 'Medium')}
            />
            <FilterOption
              label="Hard"
              count={count((recipe) => recipe.difficulty === 'Hard')}
            />
          </FilterGroup>
          <FilterGroup title="Time">
            <FilterOption
              label="Up to 15 min"
              count={count((recipe) => recipe.minutes <= 15)}
            />
            <FilterOption
              on
              label="16–30 min"
              count={count(
                (recipe) => recipe.minutes > 15 && recipe.minutes <= 30,
              )}
            />
          </FilterGroup>
        </div>
        <div className="grid grid-cols-2 content-start gap-4">
          {results.slice(0, 2).map((recipe) => (
            <MiniCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </WindowFrame>
  );
}
