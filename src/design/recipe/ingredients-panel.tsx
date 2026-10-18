'use client';

import { useState } from 'react';

import { CheckIcon, MinusIcon, PanIcon, PlusIcon } from '../icons';
import { cn } from '../ui/cn';
import { Segmented } from '../ui/segmented';
import {
  convertQuantity,
  scaleQuantity,
  type UnitSystem,
} from '@/lib/recipe/units';

type UnitChoice = 'original' | UnitSystem;

/** How each ingredient reads once the servings and units are applied. */
export function displayQuantity(
  quantity: string,
  factor: number,
  units: UnitChoice,
): string {
  const scaled = scaleQuantity(quantity, factor);
  return units === 'original' || !scaled
    ? scaled
    : convertQuantity(scaled, units);
}

/**
 * The ingredient list with its controls: change the number of servings (the
 * amounts scale), switch between the recipe's own units, metric and US, and tick
 * ingredients off as they go in the pan.
 */
export function IngredientsPanel({
  ingredients,
  cookware,
  servings,
}: {
  ingredients: [string, string][];
  cookware: string[];
  servings: number;
}) {
  const [units, setUnits] = useState<UnitChoice>('original');
  const [people, setPeople] = useState(servings);
  const [done, setDone] = useState<Set<number>>(new Set());
  const factor = people / servings;

  const toggle = (index: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight">
          Ingredients
        </h2>
        <Segmented
          label="Units"
          value={units}
          onValueChange={setUnits}
          options={[
            { value: 'original', label: 'Original' },
            { value: 'metric', label: 'Metric' },
            { value: 'us', label: 'US' },
          ]}
        />
      </div>

      <div className="rounded-control border-ink/15 mt-4 flex items-center justify-between border bg-white px-3 py-2">
        <span className="text-ink/75 text-sm">Servings</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Fewer servings"
            disabled={people <= 1}
            onClick={() => setPeople((n) => Math.max(1, n - 1))}
            className="rounded-control hover:bg-ink/5 grid h-8 w-8 place-items-center transition disabled:opacity-35"
          >
            <MinusIcon className="h-4 w-4" />
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
            className="rounded-control hover:bg-ink/5 grid h-8 w-8 place-items-center transition"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </span>
      </div>

      <ul className="divide-ink/10 border-ink/10 mt-4 divide-y border-y">
        {ingredients.map(([quantity, name], index) => {
          const ticked = done.has(index);
          return (
            <li key={`${name}-${index}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={ticked}
                onClick={() => toggle(index)}
                className="focus-visible:bg-ink/5 flex w-full items-center gap-3 py-3 text-left text-base outline-none"
              >
                <span
                  className={cn(
                    'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition',
                    ticked
                      ? 'border-ink bg-ink text-white'
                      : 'border-ink/40 bg-white',
                  )}
                >
                  {ticked ? (
                    <CheckIcon className="h-3 w-3" strokeWidth={3} />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'w-24 shrink-0 font-semibold',
                    ticked && 'text-ink/50 line-through',
                  )}
                >
                  {displayQuantity(quantity, factor, units)}
                </span>
                <span
                  className={cn(
                    'flex-1',
                    ticked ? 'text-ink/50 line-through' : 'text-ink/85',
                  )}
                >
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {cookware.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-label font-semibold uppercase">You will need</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cookware.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="border-ink/20 inline-flex h-8 items-center gap-2 rounded-full border bg-white px-3 text-sm"
              >
                <PanIcon className="text-ember h-4 w-4" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
