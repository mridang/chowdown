'use client';

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from 'react';

import { PlayIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { StepToken } from '@/lib/recipe/cooklang';

import { useRecipeState } from './recipe-state';
import { browserSpeech, speak, stopSpeaking } from './speaker';
import { spokenStep } from './step-speech';

/** A subscription that never fires: whether the browser can speak does not change. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/** Whether the browser has speech synthesis; false while rendering on the server. */
function canSpeak(): boolean {
  return browserSpeech() !== undefined;
}

/**
 * A "Read step aloud" button for cook mode. It speaks the step with the
 * amounts the page is showing, shows that it is speaking, and stops when
 * pressed again, when the step changes (give it a `key` for the step, so it
 * starts over) or when cook mode closes. It is not rendered at all in a browser
 * that cannot speak.
 */
export function ReadAloudButton({
  tokens,
  number,
}: Readonly<{
  /** The step to read. */
  tokens: readonly StepToken[];
  /** The step's number, said first. */
  number: number;
}>): ReactElement | null {
  const { quantity } = useRecipeState();
  const supported = useSyncExternalStore(
    subscribeToNothing,
    canSpeak,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  // Whatever ends the reading (the step changing, cook mode closing, the
  // button being pressed again), also silences the voice.
  useEffect(() => {
    if (!speaking) {
      return;
    }
    return () => {
      const speech = browserSpeech();
      if (speech) {
        stopSpeaking(speech.synthesiser);
      }
    };
  }, [speaking]);

  if (!supported) {
    return null;
  }

  const toggle = (): void => {
    const speech = browserSpeech();
    if (!speech) {
      return;
    }
    if (speaking) {
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(speech, spokenStep(tokens, { quantity, number }), {
      onEnd: () => setSpeaking(false),
    });
  };

  return (
    <Button variant="outline" size="lg" onClick={toggle} className="min-h-11">
      <PlayIcon size="menu" />
      {speaking ? 'Stop reading' : 'Read step aloud'}
    </Button>
  );
}
