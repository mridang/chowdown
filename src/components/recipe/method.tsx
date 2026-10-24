'use client';

import type { ReactElement } from 'react';

import { ClockIcon } from '@/components/icons';
import { Heading } from '@/components/ui/layout';
import { NumberBadge } from '@/components/ui/number-badge';
import type { StepToken } from '@/lib/cooklang/cooklang';

import { NoteChip } from '@/components/recipe/note-chip';
import { useRecipeState } from '@/components/recipe/recipe-state';

/**
 * The shared look of an inline highlight. Each kind has its own tint and weight,
 * and timers also carry a clock, so the three read apart without colour alone.
 * `box-decoration-clone` keeps the padding on both ends when a highlight wraps.
 */
const HIGHLIGHT = 'box-decoration-clone rounded px-1 py-px font-semibold';

/** One piece of a step: plain text or an ingredient, cookware or timer highlight. */
function Token({ token }: Readonly<{ token: StepToken }>): ReactElement {
  const { quantity } = useRecipeState();
  switch (token.kind) {
    case 'text':
      return <>{token.text}</>;
    case 'ingredient':
      return (
        <span
          // The amount for the servings and units chosen, on hover.
          title={token.quantity ? quantity(token.quantity) : undefined}
          className={`${HIGHLIGHT} bg-marigold/25 text-ink`}
        >
          {token.name}
        </span>
      );
    case 'cookware':
      return (
        <span className={`${HIGHLIGHT} bg-forest/10 text-forest`}>
          {token.name}
        </span>
      );
    case 'timer':
      return (
        <span className={`${HIGHLIGHT} bg-flame/10 text-ember`}>
          <ClockIcon size="sm" className="mr-1 inline-block -translate-y-px" />
          {token.label}
        </span>
      );
  }
}

/**
 * The numbered method. Ingredients, cookware and timers inside a step are
 * highlighted, and a step's own notes sit directly beneath it.
 */
export function Method({
  steps,
  notes,
}: Readonly<{
  steps: readonly (readonly StepToken[])[];
  /** Note texts per step, in step order. */
  notes: readonly (readonly string[])[];
}>): ReactElement {
  return (
    <div>
      <Heading variant="h3">Method</Heading>
      {steps.length > 0 ? (
        <ol className="mt-5 flex max-w-3xl flex-col gap-8">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-5">
              <NumberBadge value={index + 1} size="md" />
              <div className="min-w-0 pt-1">
                <p className="text-lg leading-relaxed">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.map((token, tokenIndex) => (
                    <Token key={tokenIndex} token={token} />
                  ))}
                </p>
                {(notes[index] ?? []).map((text, noteIndex) => (
                  <NoteChip key={noteIndex} text={text} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-subtle">This recipe has no method yet.</p>
      )}
    </div>
  );
}
