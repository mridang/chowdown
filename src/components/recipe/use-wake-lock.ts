'use client';

import { useEffect } from 'react';

/** What the keeper needs from the browser; the real one unless a test supplies its own. */
export interface WakeLockEnvironment {
  /** The browser's wake lock, or `undefined` where there is none. */
  readonly wakeLock: Pick<WakeLock, 'request'> | undefined;
  /** Whether the page can be seen right now. */
  readonly isVisible: () => boolean;
  /** Call `callback` whenever the page's visibility changes; returns the way to stop. */
  readonly onVisibilityChange: (callback: () => void) => () => void;
}

/** Where the keeper stands: nothing held, a request in flight, a lock held, or finished for good. */
type Holding =
  | { readonly phase: 'idle' | 'requesting' | 'stopped' }
  | {
      readonly phase: 'held';
      readonly sentinel: Pick<WakeLockSentinel, 'release'>;
    };

/**
 * Whether the keeper should ask for a lock now: only when nothing is held or
 * being asked for, and the page is visible (the browser refuses a lock for a
 * hidden page, and would release one the moment the page was hidden anyway).
 */
export function shouldRequestLock(
  holding: Holding['phase'],
  visible: boolean,
): boolean {
  return visible && holding === 'idle';
}

/**
 * Keep the screen awake for as long as the returned function is not called.
 *
 * The browser gives a wake lock up by itself every time the page is hidden (a
 * tab switch, the screen locking), and a released lock cannot be reused. So
 * this asks again each time the page becomes visible, and again if the lock is
 * released for any other reason while it is. It never reports a failure: a
 * browser without wake locks, a refusal, or a low battery just means the
 * screen may sleep, which is what it would have done anyway.
 *
 * @param environment The wake lock and page visibility to use.
 * @returns The function that lets the screen sleep again and stops watching.
 */
export function keepScreenAwake(environment: WakeLockEnvironment): () => void {
  const { wakeLock } = environment;
  if (!wakeLock) {
    return () => undefined;
  }
  // The one piece of state, held in a cell shaped like a React ref: it lives
  // outside rendering and is only ever replaced whole.
  const holding: { current: Holding } = { current: { phase: 'idle' } };

  const acquire = (): void => {
    if (!shouldRequestLock(holding.current.phase, environment.isVisible())) {
      return;
    }
    holding.current = { phase: 'requesting' };
    void wakeLock
      .request('screen')
      .then((sentinel) => {
        if (holding.current.phase === 'stopped') {
          // Stopped while the request was in flight: give it straight back.
          void sentinel.release();
          return;
        }
        holding.current = { phase: 'held', sentinel };
        // The browser releases it when the page is hidden. Note that, and ask
        // again if the page is still visible (released for another reason).
        sentinel.addEventListener('release', () => {
          if (holding.current.phase !== 'stopped') {
            holding.current = { phase: 'idle' };
            acquire();
          }
        });
      })
      .catch(() => {
        if (holding.current.phase !== 'stopped') {
          holding.current = { phase: 'idle' };
        }
      });
  };

  acquire();
  const stopWatching = environment.onVisibilityChange(acquire);
  return () => {
    stopWatching();
    const before = holding.current;
    holding.current = { phase: 'stopped' };
    if (before.phase === 'held') {
      void before.sentinel.release();
    }
  };
}

/** The real browser: its wake lock if it has one, and the document's visibility. */
function browserEnvironment(): WakeLockEnvironment {
  return {
    wakeLock: 'wakeLock' in navigator ? navigator.wakeLock : undefined,
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange: (callback) => {
      document.addEventListener('visibilitychange', callback);
      return () => document.removeEventListener('visibilitychange', callback);
    },
  };
}

/**
 * Keep the screen awake while `active`, however often the page is hidden and
 * shown again, and let it sleep when `active` ends or the component goes away.
 *
 * @param active Whether the screen should be kept awake (cook mode is open).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    return keepScreenAwake(browserEnvironment());
  }, [active]);
}
