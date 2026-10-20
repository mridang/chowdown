'use client';

import type { ReactElement } from 'react';

import { CheckIcon, ClockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

import { describeTimer, type StepTimer } from './timer-state';
import type { StepTimers } from './use-step-timers';

/** The look of a tray entry by state: a ring of colour for one that has rung, with no motion. */
const ENTRY_STATES = {
  idle: 'border-line',
  running: 'border-line',
  paused: 'border-line border-dashed',
  done: 'border-flame bg-flame/15',
} as const;

/**
 * One timer in the tray: which step it is for, the time left (a `timer` for
 * assistive technology, which does not read it out every second), and the
 * controls. Every control is a real button at least 44px tall.
 */
function TimerEntry({
  timer,
  timers,
}: Readonly<{ timer: StepTimer; timers: StepTimers }>): ReactElement {
  const view = describeTimer(timer, timer.label, timers.now);
  const step = timer.step + 1;
  const main =
    view.state === 'running'
      ? () => timers.pause(timer.id)
      : view.state === 'paused'
        ? () => timers.resume(timer.id)
        : () => timers.restart(timer.id);
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border-2 bg-white px-3 py-2',
        ENTRY_STATES[view.state],
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-subtle">
          Step {step} <span aria-hidden="true">·</span>{' '}
          <span className="sr-only">timer for </span>
          {timer.label}
        </p>
        <p
          role="timer"
          aria-label={`Step ${step} timer`}
          className="flex items-center gap-1.5 font-display text-2xl font-semibold tabular-nums"
        >
          {view.state === 'done' ? (
            <CheckIcon size="md" />
          ) : (
            <ClockIcon size="md" />
          )}
          {view.time}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 min-w-11"
          onClick={main}
        >
          {view.action}
          <span className="sr-only"> timer for step {step}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 min-w-11"
          onClick={() => timers.addMinute(timer.id)}
        >
          +1 min
          <span className="sr-only"> on the timer for step {step}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11"
          onClick={() => timers.dismiss(timer.id)}
        >
          {view.state === 'done' ? 'Dismiss' : 'Cancel'}
          <span className="sr-only"> timer for step {step}</span>
        </Button>
      </div>
    </li>
  );
}

/**
 * The running timers of cook mode, shown together above the step buttons so
 * they stay in view while the cook moves between steps. Renders nothing when
 * there are none. Quiet when idle, and a finished timer is marked with colour
 * and the word "Done", not with flashing.
 */
export function TimerTray({
  timers,
}: Readonly<{ timers: StepTimers }>): ReactElement | null {
  if (timers.timers.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Timers" className="mb-4 flex flex-col gap-2">
      {timers.timers.map((timer) => (
        <TimerEntry key={timer.id} timer={timer} timers={timers} />
      ))}
    </ul>
  );
}
