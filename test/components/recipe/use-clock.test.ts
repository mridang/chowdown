import { describe, expect, it, jest } from '@jest/globals';

import {
  CLOCK_INTERVAL_MS,
  readClock,
  subscribeToClock,
} from '@/components/recipe/use-clock';
import type { ClockEnvironment } from '@/components/recipe/use-clock';

/** A stand-in environment that records scheduling and lets the test fire events. */
function fakeEnvironment() {
  const clearInterval = jest.fn();
  const stopWatching = jest.fn();
  const setInterval = jest.fn((_callback: () => void, ms: number) => {
    expect(ms).toBe(CLOCK_INTERVAL_MS);
    return 42;
  });
  const onVisible = jest.fn((_listener: () => void) => stopWatching);
  const environment: ClockEnvironment = {
    setInterval,
    clearInterval,
    onVisible,
  };
  return { environment, clearInterval, stopWatching, setInterval, onVisible };
}

describe('subscribeToClock', () => {
  it('prompts a fresh look on every beat', () => {
    const { environment, setInterval } = fakeEnvironment();
    const onChange = jest.fn();
    subscribeToClock(onChange, environment);
    expect(setInterval.mock.calls).toHaveLength(1);
    setInterval.mock.calls[0]?.[0]();
    expect(onChange.mock.calls).toEqual([[]]);
  });

  it('prompts at once when a hidden page is shown again', () => {
    const { environment, onVisible } = fakeEnvironment();
    const onChange = jest.fn();
    subscribeToClock(onChange, environment);
    expect(onVisible.mock.calls).toHaveLength(1);
    onVisible.mock.calls[0]?.[0]();
    expect(onChange.mock.calls).toEqual([[]]);
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
