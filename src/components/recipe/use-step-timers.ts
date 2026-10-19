'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  createAlarm,
  finishedAnnouncement,
  setPageTitle,
  titleForFinished,
  vibrateOnFinish,
  type Alarm,
  type AudioContextConstructor,
} from './timer-alerts';
import {
  ADD_TIME_MS,
  newlyFinished,
  doneIds,
  settle,
  timerReducer,
  type StepTimer,
  type TimerSpec,
} from './timer-state';
import { useNow } from './use-clock';

/** What the timers offer to the rest of cook mode. */
export interface StepTimers {
  /** Every timer, as it is at this moment (any that ran out are already done). */
  readonly timers: readonly StepTimer[];
  /** The clock the countdowns were read against. */
  readonly now: number;
  /** Start, pause, resume or run again the timer for `spec`, whichever fits. */
  readonly toggle: (spec: TimerSpec) => void;
  readonly pause: (id: string) => void;
  readonly resume: (id: string) => void;
  readonly restart: (id: string) => void;
  /** Add a minute to a timer. */
  readonly addMinute: (id: string) => void;
  /** Remove a timer. */
  readonly dismiss: (id: string) => void;
  /** Remove every timer and give the beeper back; for when cook mode closes. */
  readonly clear: () => void;
  /** What a screen reader was last told: "Timer for step 3 finished". */
  readonly announcement: string;
}

/** Carries the timers from {@link CookMode} down to the steps and the tray. */
export const StepTimersContext = createContext<StepTimers | null>(null);

/**
 * The timers, or `null` outside cook mode (a step shown elsewhere, such as the
 * landing page's picture, simply has no working timers).
 */
export function useOptionalStepTimers(): StepTimers | null {
  return useContext(StepTimersContext);
}

/** The browser's audio context, under whichever name it has; `undefined` where there is none. */
function browserAudioContext(): AudioContextConstructor | undefined {
  return typeof AudioContext === 'function' ? AudioContext : undefined;
}

/**
 * Run cook mode's step timers.
 *
 * The timers are plain data (see `timer-state`): the clock is only read, never
 * counted, so a throttled or hidden tab shows the right time as soon as it is
 * looked at. This hook adds what a browser needs around that: a clock that
 * refreshes while something is running, a beep, a buzz, an announcement and the
 * tab title when a timer finishes.
 *
 * @param recipeTitle The recipe, so the tab title still says what it is.
 */
export function useStepTimers(recipeTitle: string): StepTimers {
  const [timers, dispatch] = useReducer(timerReducer, []);
  const running = timers.some((timer) => timer.phase.status === 'running');
  const now = useNow(running);
  const view = useMemo(() => settle(timers, now), [timers, now]);
  const [announcement, setAnnouncement] = useState('');

  // The beeper, made on a tap (see `prime`).
  const alarm = useRef<Alarm | undefined>(undefined);
  // Which finished timers have already rung, so each rings once.
  const alerted = useRef<ReadonlySet<string>>(new Set());

  // Record the timers that ran out in the state itself, so the clock can stop
  // refreshing once nothing is running.
  useEffect(() => {
    if (view !== timers) {
      dispatch({ type: 'settle', now: Date.now() });
    }
  }, [view, timers]);

  // Ring each timer once as it finishes.
  useEffect(() => {
    const fresh = newlyFinished(alerted.current, view);
    alerted.current = doneIds(view);
    if (fresh.length === 0) {
      return;
    }
    alarm.current?.ring();
    vibrateOnFinish(navigator);
    setAnnouncement(finishedAnnouncement(fresh));
  }, [view]);

  // While the tab is hidden, say in its title that a timer is done.
  const finishedTitle = titleForFinished(
    view.filter((timer) => timer.phase.status === 'done'),
    recipeTitle,
  );
  useEffect(() => {
    if (finishedTitle === null) {
      return;
    }
    const original = document.title;
    const page = { querySelector: () => document.querySelector('title') };
    const apply = () =>
      setPageTitle(page, document.hidden ? finishedTitle : original);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      setPageTitle(page, original);
    };
  }, [finishedTitle]);

  // Let go of the beeper when cook mode goes away.
  useEffect(
    () => () => {
      alarm.current?.close();
      alarm.current = undefined;
    },
    [],
  );

  // Every press of a timer's control is a tap, which is when the browser lets a
  // page make its beeper; make it on the first one.
  const prime = useCallback(() => {
    alarm.current ??= createAlarm(browserAudioContext());
  }, []);
  const toggle = useCallback(
    (spec: TimerSpec) => {
      prime();
      dispatch({ type: 'toggle', spec, now: Date.now() });
    },
    [prime],
  );
  const pause = useCallback(
    (id: string) => dispatch({ type: 'pause', id, now: Date.now() }),
    [],
  );
  const resume = useCallback(
    (id: string) => {
      prime();
      dispatch({ type: 'resume', id, now: Date.now() });
    },
    [prime],
  );
  const restart = useCallback(
    (id: string) => {
      prime();
      dispatch({ type: 'restart', id, now: Date.now() });
    },
    [prime],
  );
  const addMinute = useCallback(
    (id: string) => {
      prime();
      dispatch({ type: 'add', id, ms: ADD_TIME_MS, now: Date.now() });
    },
    [prime],
  );
  const dismiss = useCallback(
    (id: string) => dispatch({ type: 'dismiss', id }),
    [],
  );
  const clear = useCallback(() => {
    dispatch({ type: 'clear' });
    setAnnouncement('');
    alarm.current?.close();
    alarm.current = undefined;
  }, []);

  return {
    timers: view,
    now,
    toggle,
    pause,
    resume,
    restart,
    addMinute,
    dismiss,
    clear,
    announcement,
  };
}
