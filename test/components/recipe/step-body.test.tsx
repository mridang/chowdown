import { describe, expect, it } from '@jest/globals';
import type { ReactElement } from 'react';

import { RecipeStateProvider } from '@/components/recipe/recipe-state';
import { StepBody } from '@/components/recipe/step-body';
import {
  StepTimersContext,
  type StepTimers,
} from '@/components/recipe/use-step-timers';
import type { StepTimer } from '@/components/recipe/timer-state';
import { htmlAt } from '../render';

const MIN = 60_000;
const NOW = 5_000_000;

/** The timers as cook mode would supply them, with do-nothing controls. */
function timersWith(timers: readonly StepTimer[] = []): StepTimers {
  const nothing = () => undefined;
  return {
    timers,
    now: NOW,
    toggle: nothing,
    pause: nothing,
    resume: nothing,
    restart: nothing,
    addMinute: nothing,
    dismiss: nothing,
    clear: nothing,
    announcement: '',
  };
}

const inRecipe = (element: ReactElement, timers?: StepTimers): string =>
  htmlAt(
    <RecipeStateProvider servings={4} initialUnits="original">
      {timers ? (
        <StepTimersContext.Provider value={timers}>
          {element}
        </StepTimersContext.Provider>
      ) : (
        element
      )}
    </RecipeStateProvider>,
  );

describe('StepBody', () => {
  const body = inRecipe(
    <StepBody
      tokens={[
        { kind: 'text', text: 'Fry ' },
        { kind: 'ingredient', name: 'onion', quantity: '2' },
        { kind: 'text', text: ' in a ' },
        { kind: 'cookware', name: 'pan' },
        { kind: 'text', text: ' for ' },
        { kind: 'timer', label: '5 minutes' },
      ]}
    />,
  );

  it('underlines ingredients and shows the amount for the servings chosen', () => {
    expect(body).toMatch(/<span class="[^"]*underline[^"]*">onion<\/span>/);
    expect(body).toContain('(2)');
  });

  it('colours cookware, and gives a timer a clock', () => {
    expect(body).toMatch(/<span class="text-forest">pan<\/span>/);
    expect(body).toMatch(/<svg[^>]*>.*<\/svg>5 minutes/s);
  });

  it('leaves out the amount of an ingredient that has none', () => {
    const out = inRecipe(
      <StepBody
        tokens={[{ kind: 'ingredient', name: 'salt', quantity: '' }]}
      />,
    );
    expect(out).toContain('salt');
    expect(out).not.toContain('(');
  });
});

describe('a timer in a step', () => {
  const tokens = [
    { kind: 'text' as const, text: 'Simmer for ' },
    { kind: 'timer' as const, label: '5 minutes' },
  ];

  it('is only a label with a clock where there are no working timers', () => {
    const out = inRecipe(<StepBody tokens={tokens} stepIndex={0} />);
    expect(out).not.toContain('<button');
    expect(out).toContain('5 minutes');
  });

  it('is a button that starts the countdown in cook mode', () => {
    const out = inRecipe(
      <StepBody tokens={tokens} stepIndex={2} />,
      timersWith(),
    );
    expect(out).toMatch(/<button type="button"[^>]*>/);
    expect(out).toContain('<span class="sr-only">Start timer: </span>');
    expect(out).toContain('5 minutes</button>');
  });

  it('is a 44px target with a focus ring', () => {
    const out = inRecipe(
      <StepBody tokens={tokens} stepIndex={0} />,
      timersWith(),
    );
    expect(out).toContain('min-h-11');
    expect(out).toContain('focus-ring');
  });

  it('shows the time left and offers to pause once running', () => {
    const running: StepTimer = {
      id: '0:1',
      step: 0,
      label: '5 minutes',
      durationMs: 5 * MIN,
      phase: { status: 'running', endsAt: NOW + 4 * MIN + 7000 },
    };
    const out = inRecipe(
      <StepBody tokens={tokens} stepIndex={0} />,
      timersWith([running]),
    );
    expect(out).toContain('Pause timer: ');
    expect(out).toContain('4:07</button>');
  });

  it('offers to resume a paused timer, showing what was left', () => {
    const paused: StepTimer = {
      id: '0:1',
      step: 0,
      label: '5 minutes',
      durationMs: 5 * MIN,
      phase: { status: 'paused', remainingMs: 2 * MIN },
    };
    const out = inRecipe(
      <StepBody tokens={tokens} stepIndex={0} />,
      timersWith([paused]),
    );
    expect(out).toContain('Resume timer: ');
    expect(out).toContain('2:00</button>');
  });

  it('says Done and offers to restart once it has rung', () => {
    const done: StepTimer = {
      id: '0:1',
      step: 0,
      label: '5 minutes',
      durationMs: 5 * MIN,
      phase: { status: 'done' },
    };
    const out = inRecipe(
      <StepBody tokens={tokens} stepIndex={0} />,
      timersWith([done]),
    );
    expect(out).toContain('Restart timer: ');
    expect(out).toContain('Done</button>');
  });

  it('is told apart from the same timer in another step by its place', () => {
    const other: StepTimer = {
      id: '1:1',
      step: 1,
      label: '5 minutes',
      durationMs: 5 * MIN,
      phase: { status: 'running', endsAt: NOW + MIN },
    };
    const out = inRecipe(
      <StepBody tokens={tokens} stepIndex={0} />,
      timersWith([other]),
    );
    expect(out).toContain('Start timer: ');
  });

  it('stays a plain label when the label cannot be a length of time', () => {
    const out = inRecipe(
      <StepBody
        tokens={[{ kind: 'timer', label: 'until golden' }]}
        stepIndex={0}
      />,
      timersWith(),
    );
    expect(out).not.toContain('<button');
    expect(out).toContain('until golden');
  });

  it('stays a plain label when the step number is not given', () => {
    const out = inRecipe(<StepBody tokens={tokens} />, timersWith());
    expect(out).not.toContain('<button');
  });
});
