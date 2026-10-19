/**
 * The step timers of cook mode as plain data and pure functions.
 *
 * A timer never counts ticks. A running timer remembers the moment it ends
 * (`endsAt`), and every question about it ("how long is left?", "is it done?")
 * is answered by comparing that moment with the clock. So a tab that was
 * throttled, hidden or asleep for ten minutes is exactly right the instant it
 * wakes: nothing was lost because nothing was being counted.
 *
 * The clock is the wall clock (`Date.now()`), passed in as `now` everywhere so
 * the functions stay pure and a test can use any time it likes. The wall clock
 * is the right one for a kitchen: it keeps going while the phone sleeps, which
 * a monotonic clock does not on every browser.
 */

/** Where a timer is in its life. */
export type TimerPhase =
  | {
      /** Counting down; `endsAt` is when it rings (milliseconds since the epoch). */
      readonly status: 'running';
      readonly endsAt: number;
    }
  | {
      /** Stopped part-way; `remainingMs` is what was left. */
      readonly status: 'paused';
      readonly remainingMs: number;
    }
  | {
      /** Reached zero. */
      readonly status: 'done';
    };

/** What it takes to start a timer: which timer it is and how long it runs. */
export interface TimerSpec {
  /** Stable across renders, so starting it again finds the same timer: "step:token". */
  readonly id: string;
  /** The zero-based step it belongs to. */
  readonly step: number;
  /** The label from the recipe, such as "5 minutes". */
  readonly label: string;
  readonly durationMs: number;
}

/** A timer on its way through cook mode. */
export interface StepTimer extends TimerSpec {
  readonly phase: TimerPhase;
}

/** Everything that can happen to the timers; each carries the moment it happened. */
export type TimerAction =
  | { readonly type: 'toggle'; readonly spec: TimerSpec; readonly now: number }
  | {
      readonly type: 'pause' | 'resume' | 'restart';
      readonly id: string;
      readonly now: number;
    }
  | {
      readonly type: 'add';
      readonly id: string;
      readonly ms: number;
      readonly now: number;
    }
  | { readonly type: 'dismiss'; readonly id: string }
  | { readonly type: 'settle'; readonly now: number }
  | { readonly type: 'clear' };

/** How much "+1 min" adds. */
export const ADD_TIME_MS = 60_000;

/** A timer with its phase replaced. */
function withPhase(timer: StepTimer, phase: TimerPhase): StepTimer {
  return { ...timer, phase };
}

/** Apply `change` to the timer with this id and leave the others as they are. */
function changeTimer(
  timers: readonly StepTimer[],
  id: string,
  change: (timer: StepTimer) => StepTimer,
): readonly StepTimer[] {
  return timers.map((timer) => (timer.id === id ? change(timer) : timer));
}

/** How much time is left on a timer at `now`, never below zero. */
export function remainingMs(timer: StepTimer, now: number): number {
  switch (timer.phase.status) {
    case 'running':
      return Math.max(0, timer.phase.endsAt - now);
    case 'paused':
      return timer.phase.remainingMs;
    case 'done':
      return 0;
  }
}

/**
 * The timers as they are at `now`: any that ran out are marked done. Returns
 * the very same array when none did, so callers can tell "nothing changed" by
 * identity and React does not re-render for it.
 */
export function settle(
  timers: readonly StepTimer[],
  now: number,
): readonly StepTimer[] {
  const due = (timer: StepTimer): boolean =>
    timer.phase.status === 'running' && timer.phase.endsAt <= now;
  return timers.some(due)
    ? timers.map((timer) =>
        due(timer) ? withPhase(timer, { status: 'done' }) : timer,
      )
    : timers;
}

/** Start (or restart from the top) the timer for `spec`, keeping its place in the list. */
function startTimer(
  timers: readonly StepTimer[],
  spec: TimerSpec,
  now: number,
): readonly StepTimer[] {
  const started: StepTimer = {
    ...spec,
    phase: { status: 'running', endsAt: now + spec.durationMs },
  };
  return timers.some((timer) => timer.id === spec.id)
    ? changeTimer(timers, spec.id, () => started)
    : [...timers, started];
}

/** Stop a running timer, remembering what was left. Others are left alone. */
function pauseTimer(timer: StepTimer, now: number): StepTimer {
  return timer.phase.status === 'running'
    ? withPhase(timer, {
        status: 'paused',
        remainingMs: Math.max(0, timer.phase.endsAt - now),
      })
    : timer;
}

/** Carry on a paused timer from where it stopped. Others are left alone. */
function resumeTimer(timer: StepTimer, now: number): StepTimer {
  return timer.phase.status === 'paused'
    ? withPhase(timer, {
        status: 'running',
        endsAt: now + timer.phase.remainingMs,
      })
    : timer;
}

/** Begin a timer again from its full length, whatever state it was in. */
function restartTimer(timer: StepTimer, now: number): StepTimer {
  return withPhase(timer, {
    status: 'running',
    endsAt: now + timer.durationMs,
  });
}

/**
 * Give a timer more time. A running or paused one is extended; one that has
 * rung starts again for just the extra time (a snooze), which is what a cook
 * who says "one more minute" means.
 */
function addTime(timer: StepTimer, ms: number, now: number): StepTimer {
  switch (timer.phase.status) {
    case 'running':
      return withPhase(timer, {
        status: 'running',
        endsAt: timer.phase.endsAt + ms,
      });
    case 'paused':
      return withPhase(timer, {
        status: 'paused',
        remainingMs: timer.phase.remainingMs + ms,
      });
    case 'done':
      return withPhase(timer, { status: 'running', endsAt: now + ms });
  }
}

/**
 * What pressing a timer's own button does: start it if it is new, pause it if
 * it is running, carry on if it is paused, and run it again if it has rung.
 */
function toggleTimer(
  timers: readonly StepTimer[],
  spec: TimerSpec,
  now: number,
): readonly StepTimer[] {
  const current = timers.find((timer) => timer.id === spec.id);
  switch (current?.phase.status) {
    case 'running':
      return changeTimer(timers, spec.id, (timer) => pauseTimer(timer, now));
    case 'paused':
      return changeTimer(timers, spec.id, (timer) => resumeTimer(timer, now));
    default:
      return startTimer(timers, spec, now);
  }
}

/**
 * The reducer for the timers. Every action first settles the timers to its
 * moment, so acting on a timer that has in fact run out acts on a finished
 * one, never on a running one with a negative remainder.
 */
export function timerReducer(
  timers: readonly StepTimer[],
  action: TimerAction,
): readonly StepTimer[] {
  if (action.type === 'clear') {
    return [];
  }
  if (action.type === 'dismiss') {
    return timers.filter((timer) => timer.id !== action.id);
  }
  const current = settle(timers, action.now);
  switch (action.type) {
    case 'settle':
      return current;
    case 'toggle':
      return toggleTimer(current, action.spec, action.now);
    case 'pause':
      return changeTimer(current, action.id, (t) => pauseTimer(t, action.now));
    case 'resume':
      return changeTimer(current, action.id, (t) => resumeTimer(t, action.now));
    case 'restart':
      return changeTimer(current, action.id, (t) =>
        restartTimer(t, action.now),
      );
    case 'add':
      return changeTimer(current, action.id, (t) =>
        addTime(t, action.ms, action.now),
      );
  }
}

/** The ids of the timers that have rung. */
export function doneIds(timers: readonly StepTimer[]): ReadonlySet<string> {
  return new Set(
    timers.filter((t) => t.phase.status === 'done').map((t) => t.id),
  );
}

/**
 * The timers that have rung since the last look: done now, and not in
 * `alerted`. A timer that is restarted leaves the done set and so rings again
 * the next time it finishes.
 */
export function newlyFinished(
  alerted: ReadonlySet<string>,
  timers: readonly StepTimer[],
): readonly StepTimer[] {
  return timers.filter(
    (timer) => timer.phase.status === 'done' && !alerted.has(timer.id),
  );
}

/**
 * A countdown as a clock reads it: `4:07`, or `1:02:03` past the hour. Rounds
 * down, so a timer just started for four minutes reads `4:00` (rounding up
 * would show `4:01` for the fraction of a second the display lags the clock),
 * and the last second of a running timer reads `0:00` until it is done.
 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${two(minutes)}:${two(seconds)}`
    : `${minutes}:${two(seconds)}`;
}

/** How a timer button or tray entry should look and what pressing it does. */
export interface TimerView {
  /** The phase, for styling. `idle` is a timer that has not been started. */
  readonly state: 'idle' | TimerPhase['status'];
  /** What pressing the main button does: the words for assistive technology. */
  readonly action: 'Start' | 'Pause' | 'Resume' | 'Restart';
  /** The time to show: the recipe's label until started, then the countdown. */
  readonly time: string;
}

/**
 * What to show for a timer token: the recipe's own label before it is started,
 * then the countdown, then "Done".
 *
 * @param timer The running timer for this token, if one has been started.
 * @param label The recipe's label for it, such as "5 minutes".
 * @param now The clock.
 */
export function describeTimer(
  timer: StepTimer | undefined,
  label: string,
  now: number,
): TimerView {
  switch (timer?.phase.status) {
    case 'running':
      return {
        state: 'running',
        action: 'Pause',
        time: formatRemaining(remainingMs(timer, now)),
      };
    case 'paused':
      return {
        state: 'paused',
        action: 'Resume',
        time: formatRemaining(remainingMs(timer, now)),
      };
    case 'done':
      return { state: 'done', action: 'Restart', time: 'Done' };
    default:
      return { state: 'idle', action: 'Start', time: label };
  }
}
