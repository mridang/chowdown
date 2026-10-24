import { describe, expect, it, jest } from '@jest/globals';

import {
  CLOCK_INTERVAL_MS,
  readClock,
  subscribeToClock,
  type ClockEnvironment,
} from '@/components/recipe/use-clock';

/** A stand-in environment that records scheduling and lets the test fire events. */
function fakeEnvironment() {
  const clearInterval = jest.fn();
  const stopWatching = jest.fn();
  const callbacks: {
    readonly beat: Array<() => void>;
    readonly visible: Array<() => void>;
  } = {
    beat: [],
    visible: [],
  };
  const environment: ClockEnvironment = {
    setInterval: (callback, ms) => {
      expect(ms).toBe(CLOCK_INTERVAL_MS);
      callbacks.beat.push(callback);
      return 42;
    },
    clearInterval,
    onVisible: (callback) => {
      callbacks.visible.push(callback);
      return stopWatching;
    },
  };
  return { environment, clearInterval, stopWatching, callbacks };
}

describe('subscribeToClock', () => {
  it('prompts a fresh look on every beat', () => {
    const { environment, callbacks } = fakeEnvironment();
    const onChange = jest.fn();
    subscribeToClock(onChange, environment);
    callbacks.beat.forEach((beat) => beat());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('prompts at once when a hidden page is shown again', () => {
    const { environment, callbacks } = fakeEnvironment();
    const onChange = jest.fn();
    subscribeToClock(onChange, environment);
    callbacks.visible.forEach((visible) => visible());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops the beat and the watching when unsubscribed', () => {
    const { environment, clearInterval, stopWatching } = fakeEnvironment();
    subscribeToClock(() => undefined, environment)();
    expect(clearInterval).toHaveBeenCalledWith(42);
    expect(stopWatching).toHaveBeenCalledTimes(1);
  });
});

describe('readClock', () => {
  it('rounds down to the beat, so two reads in one beat agree', () => {
    expect(readClock(1_000_000)).toBe(
      readClock(1_000_000 + CLOCK_INTERVAL_MS - 1),
    );
    expect(readClock(1_000_000 + CLOCK_INTERVAL_MS)).toBe(
      readClock(1_000_000) + CLOCK_INTERVAL_MS,
    );
  });

  it('reads the wall clock when not given a time', () => {
    const before = Date.now();
    const read = readClock();
    expect(read).toBeLessThanOrEqual(Date.now());
    expect(read).toBeGreaterThan(before - CLOCK_INTERVAL_MS - 1);
  });
});
