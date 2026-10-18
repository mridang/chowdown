'use client';

import { ClockIcon } from '@/components/icons';
import { Heading } from '@/components/ui/layout';
import type { StepToken } from '@/lib/recipe/cooklang';

import { NoteChip } from './note-chip';
import { useRecipeState } from './recipe-state';

/**
 * The shared look of an inline highlight. Each kind has its own tint and weight,
 * and timers also carry a clock, so the three read apart without colour alone.
 * `box-decoration-clone` keeps the padding on both ends when a highlight wraps.
 */
const HIGHLIGHT = 'box-decoration-clone rounded px-1 py-px font-semibold';

/** One piece of a step: plain text or an ingredient, cookware or timer highlight. */
function Token({ token }: { token: StepToken }) {
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
          <ClockIcon className="mr-1 inline-block h-4 w-4 -translate-y-px" />
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
}: {
  steps: StepToken[][];
  /** Note texts per step, in step order. */
  notes: string[][];
}) {
  return (
    <div>
      <Heading variant="h3">Method</Heading>
      {steps.length > 0 ? (
        <ol className="mt-5 flex max-w-3xl flex-col gap-8">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-5">
              <span
                aria-hidden="true"
                className="bg-flame text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-semibold"
              >
                {index + 1}
              </span>
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
        <p className="text-ink/65 mt-4">This recipe has no method yet.</p>
      )}
    </div>
  );
}
