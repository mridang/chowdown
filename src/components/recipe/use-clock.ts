'use client';

import { useSyncExternalStore } from 'react';

/** How often the displayed countdown is refreshed while a timer runs, in milliseconds. */
export const CLOCK_INTERVAL_MS = 250;

/** What the clock listens to and schedules with; the browser's, unless a test supplies its own. */
export interface ClockEnvironment {
  readonly setInterval: (callback: () => void, ms: number) => number;
  readonly clearInterval: (handle: number) => void;
  /** Call `callback` whenever the page becomes visible again; returns the way to stop. */
  readonly onVisible: (callback: () => void) => () => void;
}

/** The real browser's scheduling and visibility. */
const BROWSER: ClockEnvironment = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (handle) => window.clearInterval(handle),
  onVisible: (callback) => {
    const onChange = () => {
      if (document.visibilityState === 'visible') {
        callback();
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  },
};

/**
 * Ask to be told when the clock moves on: on a steady beat, and at once when a
 * hidden page is brought back (a hidden page's beat is slowed or stopped by
 * the browser, so the first thing to do on return is look at the time again).
 * Returns the function that stops the asking.
 *
 * The beat only prompts a fresh look at the wall clock; it is never counted,
 * so a slowed beat makes the display late, never wrong.
 */
export function subscribeToClock(
  onChange: () => void,
  environment: ClockEnvironment = BROWSER,
): () => void {
  const handle = environment.setInterval(onChange, CLOCK_INTERVAL_MS);
  const stopWatching = environment.onVisible(onChange);
  return () => {
    environment.clearInterval(handle);
    stopWatching();
  };
}

/** The wall clock, rounded down to the beat so two reads in one beat agree. */
export function readClock(now: number = Date.now()): number {
  return Math.floor(now / CLOCK_INTERVAL_MS) * CLOCK_INTERVAL_MS;
}

/** A subscription that never fires, for when nothing is counting down. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * The current time, refreshed several times a second while `running`, and read
 * fresh on every render otherwise. It is a store the page subscribes to only
 * while a timer needs it, so a cook mode with no timer running does no work.
 * On the server (cook mode is closed there) it reads zero.
 *
 * @param running Whether anything is counting down and needs the refreshing.
 */
export function useNow(running: boolean): number {
  return useSyncExternalStore(
    running ? subscribeToClock : subscribeToNothing,
    readClock,
    () => 0,
  );
}
