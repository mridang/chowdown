'use client';

import type { ReactElement } from 'react';

import { ClockIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import type { StepToken } from '@/lib/recipe/cooklang';

import { useRecipeState } from './recipe-state';
import { parseDurationMs } from './timer-duration';
import { describeTimer, type TimerView } from './timer-state';
import { useOptionalStepTimers } from './use-step-timers';

/** The look of a timer button in each state: quiet until started, strongest when it has rung. */
const CHIP_STATES: Readonly<Record<TimerView['state'], string>> = {
  idle: 'border-ember/40 hover:bg-ember/10',
  running: 'border-ember bg-ember/10',
  paused: 'border-ember border-dashed',
  done: 'border-flame bg-flame text-ink',
};

/**
 * A timer in a step. With working timers around it (cook mode) and a label
 * that can be read as a length of time, it is a button that starts the
 * countdown, then shows what is left and pauses or resumes it. Otherwise it is
 * the plain label with a clock, as the page has always shown it.
 */
function TimerToken({
  label,
  stepIndex,
  tokenIndex,
}: Readonly<{
  label: string;
  stepIndex: number | undefined;
  tokenIndex: number;
}>): ReactElement {
  const timers = useOptionalStepTimers();
  const durationMs = parseDurationMs(label);
  if (!timers || stepIndex === undefined || durationMs === null) {
    return (
      <span className="text-ember whitespace-nowrap">
        <ClockIcon className="mr-1 inline-block h-[0.8em] w-[0.8em] -translate-y-px" />
        {label}
      </span>
    );
  }
  const id = `${stepIndex}:${tokenIndex}`;
  const view = describeTimer(
    timers.timers.find((timer) => timer.id === id),
    label,
    timers.now,
  );
  return (
    <button
      type="button"
      onClick={() => timers.toggle({ id, step: stepIndex, label, durationMs })}
      className={cn(
        // `min-h-11`: a 44px target, even in the smaller type of a long step.
        'text-ember focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 align-middle text-[0.8em] font-semibold whitespace-nowrap tabular-nums transition-colors',
        CHIP_STATES[view.state],
      )}
    >
      <ClockIcon className="h-[0.8em] w-[0.8em]" />
      <span className="sr-only">{view.action} timer: </span>
      {view.time}
    </button>
  );
}

/**
 * The current step in large type. Ingredients are underlined and followed by
 * the amount for the servings and units chosen, so the number is right there at
 * the stove; timers get a clock, and in cook mode they are buttons that start
 * a countdown.
 *
 * @param tokens The step.
 * @param stepIndex The zero-based step number, which a working timer needs to
 *   be told apart from the same timer in another step; leave out to show timers
 *   as plain labels.
 */
export function StepBody({
  tokens,
  stepIndex,
}: Readonly<{
  tokens: readonly StepToken[];
  stepIndex?: number;
}>): ReactElement {
  const { quantity } = useRecipeState();
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case 'text':
            return <span key={index}>{token.text}</span>;
          case 'ingredient':
            return (
              <span key={index}>
                <span className="decoration-marigold underline decoration-4 underline-offset-4">
                  {token.name}
                </span>
                {token.quantity ? (
                  <span className="text-subtle text-[0.6em] font-normal">
                    {' '}
                    ({quantity(token.quantity)})
                  </span>
                ) : null}
              </span>
            );
          case 'cookware':
            return (
              <span key={index} className="text-forest">
                {token.name}
              </span>
            );
          case 'timer':
            return (
              <TimerToken
                key={index}
                label={token.label}
                stepIndex={stepIndex}
                tokenIndex={index}
              />
            );
        }
      })}
    </>
  );
}
