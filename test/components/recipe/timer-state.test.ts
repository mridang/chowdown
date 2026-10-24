import { describe, expect, it } from '@jest/globals';

import {
  ADD_TIME_MS,
  describeTimer,
  doneIds,
  formatRemaining,
  newlyFinished,
  remainingMs,
  settle,
  timerReducer,
  type StepTimer,
  type TimerAction,
  type TimerSpec,
} from '@/components/recipe/timer-state';

const MIN = 60_000;
const T0 = 1_000_000;

const spec = (id: string, durationMs = 5 * MIN, step = 0): TimerSpec => ({
  id,
  step,
  label: '5 minutes',
  durationMs,
});

/** Apply actions in order from no timers. */
const run = (...actions: readonly TimerAction[]): readonly StepTimer[] =>
  actions.reduce<readonly StepTimer[]>(timerReducer, []);

const toggle = (s: TimerSpec, now: number): TimerAction => ({
  type: 'toggle',
  spec: s,
  now,
});

describe('toggle', () => {
  it('starts a new timer for its whole length', () => {
    const [timer] = run(toggle(spec('0:1'), T0));
    expect(timer?.phase).toEqual({ status: 'running', endsAt: T0 + 5 * MIN });
    expect(timer && remainingMs(timer, T0 + MIN)).toBe(4 * MIN);
  });

  it('pauses a running timer, keeping what was left', () => {
    const [timer] = run(toggle(spec('0:1'), T0), toggle(spec('0:1'), T0 + MIN));
    expect(timer?.phase).toEqual({ status: 'paused', remainingMs: 4 * MIN });
  });

  it('resumes a paused timer from where it stopped', () => {
    const [timer] = run(
      toggle(spec('0:1'), T0),
      toggle(spec('0:1'), T0 + MIN),
      toggle(spec('0:1'), T0 + 10 * MIN),
    );
    expect(timer?.phase).toEqual({
      status: 'running',
      endsAt: T0 + 10 * MIN + 4 * MIN,
    });
  });

  it('runs a finished timer again from the top', () => {
    const [timer] = run(
      toggle(spec('0:1'), T0),
      toggle(spec('0:1'), T0 + 6 * MIN),
    );
    expect(timer?.phase).toEqual({
      status: 'running',
      endsAt: T0 + 6 * MIN + 5 * MIN,
    });
  });

  it('runs several timers at once, in the order they were started', () => {
    const timers = run(
      toggle(spec('0:1'), T0),
      toggle(spec('1:0', MIN, 1), T0 + 1),
    );
    expect(timers.map((t) => t.id)).toEqual(['0:1', '1:0']);
    expect(timers.every((t) => t.phase.status === 'running')).toBe(true);
  });

  it('touches only the timer it was pressed for', () => {
    const [first, second] = run(
      toggle(spec('0:1'), T0),
      toggle(spec('1:0', MIN, 1), T0),
      toggle(spec('0:1'), T0 + 1),
    );
    expect(first?.phase.status).toBe('paused');
    expect(second?.phase.status).toBe('running');
  });
});

describe('pause, resume and restart', () => {
  it('pauses and resumes by id', () => {
    const paused = run(toggle(spec('a'), T0), {
      type: 'pause',
      id: 'a',
      now: T0 + MIN,
    });
    expect(paused[0]?.phase).toEqual({
      status: 'paused',
      remainingMs: 4 * MIN,
    });
    const resumed = timerReducer(paused, {
      type: 'resume',
      id: 'a',
      now: T0 + 2 * MIN,
    });
    expect(resumed[0]?.phase).toEqual({
      status: 'running',
      endsAt: T0 + 2 * MIN + 4 * MIN,
    });
  });

  it('ignores pause on a timer that is not running and resume on one that is not paused', () => {
    const running = run(toggle(spec('a'), T0));
    expect(
      timerReducer(running, { type: 'resume', id: 'a', now: T0 })[0],
    ).toEqual(running[0]);
    const paused = timerReducer(running, { type: 'pause', id: 'a', now: T0 });
    expect(timerReducer(paused, { type: 'pause', id: 'a', now: T0 })).toEqual(
      paused,
    );
  });

  it('restarts from the full length whatever state it is in', () => {
    const half = run(toggle(spec('a'), T0), {
      type: 'restart',
      id: 'a',
      now: T0 + 2 * MIN,
    });
    expect(half[0]?.phase).toEqual({
      status: 'running',
      endsAt: T0 + 2 * MIN + 5 * MIN,
    });
  });

  it('ignores an id it does not know', () => {
    const timers = run(toggle(spec('a'), T0));
    expect(timerReducer(timers, { type: 'pause', id: 'zzz', now: T0 })).toEqual(
      timers,
    );
  });
});

describe('add', () => {
  it('extends a running timer by moving its end', () => {
    const [timer] = run(toggle(spec('a'), T0), {
      type: 'add',
      id: 'a',
      ms: ADD_TIME_MS,
      now: T0 + MIN,
    });
    expect(timer && remainingMs(timer, T0 + MIN)).toBe(5 * MIN);
  });

  it('extends a paused timer by adding to what was left', () => {
    const [timer] = run(
      toggle(spec('a'), T0),
      { type: 'pause', id: 'a', now: T0 + MIN },
      { type: 'add', id: 'a', ms: ADD_TIME_MS, now: T0 + 2 * MIN },
    );
    expect(timer?.phase).toEqual({ status: 'paused', remainingMs: 5 * MIN });
  });

  it('starts a finished timer again for just the extra time, as a snooze', () => {
    const [timer] = run(toggle(spec('a'), T0), {
      type: 'add',
      id: 'a',
      ms: ADD_TIME_MS,
      now: T0 + 9 * MIN,
    });
    expect(timer?.phase).toEqual({
      status: 'running',
      endsAt: T0 + 9 * MIN + MIN,
    });
  });
});

describe('dismiss and clear', () => {
  it('removes one timer', () => {
    const timers = run(toggle(spec('a'), T0), toggle(spec('b'), T0), {
      type: 'dismiss',
      id: 'a',
    });
    expect(timers.map((t) => t.id)).toEqual(['b']);
  });

  it('removes them all', () => {
    expect(
      run(toggle(spec('a'), T0), toggle(spec('b'), T0), { type: 'clear' }),
    ).toEqual([]);
  });
});

describe('settle', () => {
  it('marks a timer done once its moment has passed, and not before', () => {
    const timers = run(toggle(spec('a'), T0));
    expect(settle(timers, T0 + 5 * MIN - 1)[0]?.phase.status).toBe('running');
    expect(settle(timers, T0 + 5 * MIN)[0]?.phase.status).toBe('done');
  });

  it('returns the very same array when nothing has finished', () => {
    const timers = run(toggle(spec('a'), T0));
    expect(settle(timers, T0 + MIN)).toBe(timers);
    expect(settle([], T0)).toEqual([]);
  });

  it('is right after a long gap: a throttled tab loses nothing', () => {
    const timers = run(toggle(spec('a'), T0), toggle(spec('b', 20 * MIN), T0));
    const later = settle(timers, T0 + 12 * MIN);
    expect(later.map((t) => t.phase.status)).toEqual(['done', 'running']);
    expect(later[1] && remainingMs(later[1], T0 + 12 * MIN)).toBe(8 * MIN);
  });

  it('leaves paused timers alone however long it has been', () => {
    const timers = run(toggle(spec('a'), T0), {
      type: 'pause',
      id: 'a',
      now: T0 + MIN,
    });
    expect(settle(timers, T0 + 99 * MIN)).toBe(timers);
  });

  it('is applied before every action: pausing a run-out timer leaves it done', () => {
    const [timer] = run(toggle(spec('a'), T0), {
      type: 'pause',
      id: 'a',
      now: T0 + 9 * MIN,
    });
    expect(timer?.phase.status).toBe('done');
  });

  it('the settle action applies it to the state', () => {
    const [timer] = run(toggle(spec('a'), T0), {
      type: 'settle',
      now: T0 + 6 * MIN,
    });
    expect(timer?.phase).toEqual({ status: 'done' });
  });
});

describe('remainingMs', () => {
  it('is never negative', () => {
    const [timer] = run(toggle(spec('a'), T0));
    expect(timer && remainingMs(timer, T0 + 99 * MIN)).toBe(0);
  });

  it('is zero for a done timer', () => {
    const [timer] = settle(run(toggle(spec('a'), T0)), T0 + 6 * MIN);
    expect(timer && remainingMs(timer, T0)).toBe(0);
  });
});

describe('newlyFinished and doneIds', () => {
  const timers = settle(
    run(toggle(spec('a'), T0), toggle(spec('b', 20 * MIN), T0)),
    T0 + 6 * MIN,
  );

  it('lists the done timers that have not rung', () => {
    expect(newlyFinished(new Set(), timers).map((t) => t.id)).toEqual(['a']);
  });

  it('does not list one twice', () => {
    expect(newlyFinished(doneIds(timers), timers)).toEqual([]);
  });

  it('lists a restarted timer again when it next finishes', () => {
    const restarted = timerReducer(timers, {
      type: 'restart',
      id: 'a',
      now: T0 + 7 * MIN,
    });
    const rung = doneIds(restarted);
    expect(rung.has('a')).toBe(false);
    const again = settle(restarted, T0 + 13 * MIN);
    expect(newlyFinished(rung, again).map((t) => t.id)).toEqual(['a']);
  });
});

describe('formatRemaining', () => {
  it.each([
    [0, '0:00'],
    [-5, '0:00'],
    [1, '0:00'],
    [999, '0:00'],
    [1000, '0:01'],
    [1999, '0:01'],
    [4 * MIN + 100, '4:00'],
    [59_000, '0:59'],
    [60_000, '1:00'],
    [4 * MIN + 7_000, '4:07'],
    [59 * MIN + 59_000, '59:59'],
    [60 * MIN, '1:00:00'],
    [3_723_000, '1:02:03'],
  ])('shows %p ms as %p', (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});

describe('describeTimer', () => {
  const [running] = run(toggle(spec('a'), T0));
  const paused = run(toggle(spec('a'), T0), {
    type: 'pause',
    id: 'a',
    now: T0 + MIN,
  })[0];
  const done = settle(run(toggle(spec('a'), T0)), T0 + 9 * MIN)[0];

  it('shows the recipe’s own label before it is started', () => {
    expect(describeTimer(undefined, '5 minutes', T0)).toEqual({
      state: 'idle',
      action: 'Start',
      time: '5 minutes',
    });
  });

  it('shows the countdown while running, and offers to pause', () => {
    expect(describeTimer(running, '5 minutes', T0 + MIN)).toEqual({
      state: 'running',
      action: 'Pause',
      time: '4:00',
    });
  });

  it('shows what was left while paused, and offers to resume', () => {
    expect(describeTimer(paused, '5 minutes', T0 + 99 * MIN)).toEqual({
      state: 'paused',
      action: 'Resume',
      time: '4:00',
    });
  });

  it('says Done once it has rung, and offers to run it again', () => {
    expect(describeTimer(done, '5 minutes', T0 + 9 * MIN)).toEqual({
      state: 'done',
      action: 'Restart',
      time: 'Done',
    });
  });
});
