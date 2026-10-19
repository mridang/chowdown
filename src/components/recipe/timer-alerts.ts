import type { StepTimer } from './timer-state';

/**
 * How a finished timer gets the cook's attention: a short beep, a buzz, words
 * for a screen reader, and the browser tab's title for when the tab is hidden.
 * Each is a small function that takes the browser feature it needs as an
 * argument, so the behaviour can be checked without a browser and the page
 * still works where a feature is missing.
 */

/** The part of an audio context the beep uses. */
interface BeepContext {
  readonly currentTime: number;
  readonly destination: AudioNode;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  resume(): Promise<void>;
  close(): Promise<void>;
}

/** A constructor for audio contexts: `AudioContext`, or Safari's older name for it. */
export type AudioContextConstructor = new () => BeepContext;

/** A beeper: ring it when a timer finishes, close it when cook mode ends. */
export interface Alarm {
  /** Play the beeps. Silent, without error, if the browser refuses. */
  readonly ring: () => void;
  /** Give the audio hardware back. */
  readonly close: () => void;
}

/** When each beep starts, in seconds after the alarm is rung: three, with a pause between. */
export const BEEP_OFFSETS: readonly number[] = [0, 0.35, 0.7];

/** How long one beep lasts, in seconds. */
const BEEP_LENGTH = 0.22;

/** The pitch of the beep, in hertz: a clear A5 that carries across a kitchen. */
const BEEP_PITCH = 880;

/** The loudest the beep gets; well below full scale, because it is close to the ear. */
const BEEP_LEVEL = 0.2;

/** A level a gain can ramp from and to; exponential ramps cannot touch zero. */
const SILENT = 0.0001;

/** Play one beep starting `at` seconds on the context's clock, shaped so it does not click. */
function beepAt(context: BeepContext, at: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(BEEP_PITCH, at);
  // Fade in and out over a few milliseconds: a tone that starts and stops
  // abruptly clicks.
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(BEEP_LEVEL, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(SILENT, at + BEEP_LENGTH);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + BEEP_LENGTH + 0.02);
}

/**
 * Make the beeper. Call it from the tap that starts a timer: browsers only
 * allow sound that began with a user gesture, and an audio context made then
 * (and resumed) stays allowed for the minutes the timer runs.
 *
 * @param Context The browser's audio context constructor; `undefined` where
 *   there is none, which gives no alarm and so no sound.
 */
export function createAlarm(
  Context: AudioContextConstructor | undefined,
): Alarm | undefined {
  if (!Context) {
    return undefined;
  }
  const context = new Context();
  // Created from a gesture it should already be running; resume covers a
  // browser that starts it suspended.
  void context.resume().catch(() => undefined);
  return {
    ring: () => {
      void context
        .resume()
        .then(() =>
          BEEP_OFFSETS.forEach((offset) =>
            beepAt(context, context.currentTime + offset),
          ),
        )
        .catch(() => undefined);
    },
    close: () => {
      void context.close().catch(() => undefined);
    },
  };
}

/** The vibration pattern when a timer finishes, in milliseconds: buzz, pause, buzz. */
export const VIBRATION_PATTERN: readonly number[] = [200, 100, 200];

/**
 * Buzz the phone, where it can. Chrome on Android does; Safari has no
 * vibration, so there `navigator.vibrate` is missing and this does nothing.
 *
 * @param nav The browser's `navigator`, or anything with a `vibrate` method.
 */
export function vibrateOnFinish(
  nav: Readonly<{ vibrate?: (pattern: number[]) => boolean }>,
): void {
  nav.vibrate?.([...VIBRATION_PATTERN]);
}

/** What a screen reader says when a timer finishes: "Timer for step 3 finished". */
export function finishedMessage(timer: Pick<StepTimer, 'step'>): string {
  return `Timer for step ${timer.step + 1} finished`;
}

/** What a screen reader says when several finish at once, one after another. */
export function finishedAnnouncement(
  timers: readonly Pick<StepTimer, 'step'>[],
): string {
  return timers.map(finishedMessage).join('. ');
}

/**
 * The tab title while a finished timer waits and the tab is hidden, so the
 * name in the tab or the taskbar says the timer is done; `null` when none is.
 *
 * @param finished The timers that have rung and not yet been dismissed.
 * @param recipeTitle The recipe, so the tab still says what it is.
 */
export function titleForFinished(
  finished: readonly Pick<StepTimer, 'step'>[],
  recipeTitle: string,
): string | null {
  const [first] = finished;
  if (first === undefined) {
    return null;
  }
  const what =
    finished.length === 1
      ? `Timer done (step ${first.step + 1})`
      : `${finished.length} timers done`;
  return `${what} - ${recipeTitle}`;
}

/**
 * Set the page title. The title element's text is replaced through a method
 * rather than by assigning `document.title`, and the caller puts the old one
 * back. Does nothing on a page without a title element.
 */
export function setPageTitle(
  page: Readonly<{
    querySelector: (
      selector: 'title',
    ) => Pick<Element, 'replaceChildren'> | null;
  }>,
  title: string,
): void {
  page.querySelector('title')?.replaceChildren(title);
}
