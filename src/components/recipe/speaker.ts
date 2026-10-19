/**
 * Reading text aloud with the browser's speech synthesis, as small functions
 * that take the synthesiser as an argument so they can be checked without a
 * browser.
 *
 * The utterance's language is deliberately left unset: the speech spec says an
 * utterance with no `lang` is spoken in the language of the page's `<html
 * lang>`, which is exactly "respect the document language" without anything to
 * get wrong, and the browser's own default when the page names none.
 */

/** The part of a speech synthesiser reading aloud needs. */
export type Synthesiser = Pick<SpeechSynthesis, 'speak' | 'cancel'>;

/** What reading aloud needs from the browser. */
export interface SpeechEnvironment {
  readonly synthesiser: Synthesiser;
  /** Make an utterance of this text. */
  readonly createUtterance: (text: string) => SpeechSynthesisUtterance;
}

/** What the caller wants to hear about. */
export interface SpeechListeners {
  /** The reading finished, or failed for a reason other than being stopped. */
  readonly onEnd: () => void;
}

/**
 * Whether a speech error just means the reading was stopped on purpose: by
 * `cancel()`, or by another utterance taking over. Those are not the end of
 * *this* reading as far as the page is concerned (it stopped it itself, and
 * already knows).
 */
export function isStoppedOnPurpose(error: string | undefined): boolean {
  return error === 'canceled' || error === 'interrupted';
}

/**
 * Start reading `text` aloud, after stopping anything already being read.
 *
 * @param environment The browser's synthesiser and utterance constructor.
 * @param text What to say.
 * @param listeners Told when the reading ends by itself.
 */
export function speak(
  environment: SpeechEnvironment,
  text: string,
  listeners: SpeechListeners,
): void {
  const utterance = environment.createUtterance(text);
  utterance.addEventListener('end', listeners.onEnd);
  utterance.addEventListener('error', (event) => {
    if (!isStoppedOnPurpose(event.error)) {
      listeners.onEnd();
    }
  });
  environment.synthesiser.cancel();
  environment.synthesiser.speak(utterance);
}

/** Stop reading aloud. */
export function stopSpeaking(
  synthesiser: Pick<SpeechSynthesis, 'cancel'>,
): void {
  synthesiser.cancel();
}

/** The browser's speech environment, or `undefined` where there is no speech synthesis. */
export function browserSpeech(): SpeechEnvironment | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? {
        synthesiser: window.speechSynthesis,
        createUtterance: (text) => new SpeechSynthesisUtterance(text),
      }
    : undefined;
}
