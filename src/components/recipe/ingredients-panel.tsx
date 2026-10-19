'use client';

import { useState, type ReactElement } from 'react';

import { CheckIcon, MinusIcon, PanIcon, PlusIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { Segmented } from '@/components/ui/segmented';
import type { UnitChoice } from '@/lib/recipe/page-view';

import { NoteChip } from './note-chip';
import { useRecipeState } from './recipe-state';

/** One line of the ingredient list, with any personal notes that belong to it. */
export interface PanelIngredient {
  readonly name: string;
  readonly quantity: string;
  readonly notes: readonly string[];
}

/**
 * The set with `index` ticked if it was not, or un-ticked if it was. Returns a
 * new set; the one passed in is left as it was.
 */
export function toggledIn(
  ticked: ReadonlySet<number>,
  index: number,
): ReadonlySet<number> {
  return ticked.has(index)
    ? new Set([...ticked].filter((i) => i !== index))
    : new Set([...ticked, index]);
}

/**
 * The ingredient list with its controls: change the number of servings (the
 * amounts scale), switch between the recipe's own units, metric, US and
 * imperial, and tick ingredients off as they go in the pan. Servings and units
 * live in the page's shared recipe state, so the method and cook mode agree.
 */
export function IngredientsPanel({
  ingredients,
  cookware,
}: Readonly<{
  ingredients: readonly PanelIngredient[];
  cookware: readonly string[];
}>): ReactElement {
  const { people, setPeople, units, setUnits, quantity } = useRecipeState();
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  // Only reserve a column for amounts when some ingredient has one, so a recipe
  // that writes them into the name doesn't get a blank gap.
  const hasAmounts = ingredients.some((ingredient) => ingredient.quantity);

  const toggle = (index: number) =>
    setDone((current) => toggledIn(current, index));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading as="h2" variant="h3">
          Ingredients
        </Heading>
        {ingredients.length > 0 ? (
          <Segmented<UnitChoice>
            label="Units"
            value={units}
            onValueChange={setUnits}
            options={[
              { value: 'original', label: 'Original' },
              { value: 'metric', label: 'Metric' },
              { value: 'us', label: 'US' },
              { value: 'imperial', label: 'Imperial' },
            ]}
          />
        ) : null}
      </div>

      <div className="rounded-control border-line mt-4 flex items-center justify-between border bg-white px-3 py-2">
        <span className="text-muted text-sm" id="servings-label">
          Servings
        </span>
        <span
          className="flex items-center gap-1"
          role="group"
          aria-labelledby="servings-label"
        >
          <button
            type="button"
            aria-label="Fewer servings"
            disabled={people <= 1}
            onClick={() => setPeople((n) => Math.max(1, n - 1))}
            className="rounded-control hover:bg-ink/5 grid h-9 w-9 place-items-center transition disabled:opacity-35 focus-ring-flush"
          >
            <MinusIcon size="sm" />
          </button>
          <span
            className="w-8 text-center text-base font-semibold tabular-nums"
            aria-live="polite"
          >
            {people}
          </span>
          <button
            type="button"
            aria-label="More servings"
            onClick={() => setPeople((n) => n + 1)}
            className="rounded-control hover:bg-ink/5 grid h-9 w-9 place-items-center transition focus-ring-flush"
          >
            <PlusIcon size="sm" />
          </button>
        </span>
      </div>

      {ingredients.length > 0 ? (
        <ul className="divide-line border-line mt-4 divide-y border-y">
          {ingredients.map((ingredient, index) => {
            const ticked = done.has(index);
            return (
              <li key={`${ingredient.name}-${index}`} className="py-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={ticked}
                  onClick={() => toggle(index)}
                  className="flex min-h-11 w-full items-center gap-3 py-2 text-left text-base focus-ring-flush"
                >
                  <span
                    className={cn(
                      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition',
                      ticked
                        ? 'border-ink bg-ink text-white'
                        : 'border-ink/50 bg-white',
                    )}
                  >
                    {ticked ? <CheckIcon size="xs" strokeWidth={3} /> : null}
                  </span>
                  {hasAmounts ? (
                    <span
                      className={cn(
                        'w-24 shrink-0 font-semibold',
                        ticked && 'text-subtle line-through',
                      )}
                    >
                      {quantity(ingredient.quantity)}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'flex-1',
                      ticked ? 'text-subtle line-through' : 'text-muted',
                    )}
                  >
                    {ingredient.name}
                  </span>
                </button>
                {ingredient.notes.map((text, noteIndex) => (
                  <NoteChip
                    key={noteIndex}
                    text={text}
                    className="mb-1.5 ml-[calc(18px+0.75rem)]"
                  />
                ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-subtle mt-4 text-sm">
          This recipe doesn&apos;t list any ingredients yet.
        </p>
      )}

      {cookware.length > 0 ? (
        <div className="mt-8">
          <Eyebrow as="h3" tone="subtle">
            You will need
          </Eyebrow>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cookware.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="border-field inline-flex h-8 items-center gap-2 rounded-full border bg-white px-3 text-sm"
              >
                <PanIcon size="sm" className="text-ember" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
