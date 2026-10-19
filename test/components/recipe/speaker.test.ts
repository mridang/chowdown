import { describe, expect, it, jest } from '@jest/globals';

import {
  browserSpeech,
  isStoppedOnPurpose,
  speak,
  stopSpeaking,
  type SpeechEnvironment,
} from '../../../src/components/recipe/speaker';

/** An utterance that records its listeners so a test can fire them. */
function fakeUtterance(text: string) {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    text,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    fire: (type: string, event: unknown = {}) =>
      listeners.get(type)?.forEach((listener) => listener(event)),
  };
}

function fakeSpeech() {
  const utterances: ReturnType<typeof fakeUtterance>[] = [];
  const order: string[] = [];
  const synthesiser = {
    speak: jest.fn<(utterance: unknown) => number>(() => order.push('speak')),
    cancel: jest.fn(() => order.push('cancel')),
  };
  const environment: SpeechEnvironment = {
    synthesiser: synthesiser as never,
    createUtterance: (text) => {
      const made = fakeUtterance(text);
      utterances.push(made);
      return made as never;
    },
  };
  return { environment, synthesiser, utterances, order };
}

describe('speak', () => {
  it('stops anything already being read, then reads the text', () => {
    const { environment, synthesiser, utterances, order } = fakeSpeech();
    speak(environment, 'Chop the onion.', { onEnd: () => undefined });
    expect(order).toEqual(['cancel', 'speak']);
    expect(synthesiser.speak).toHaveBeenCalledWith(utterances[0]);
    expect(utterances[0]?.text).toBe('Chop the onion.');
  });

  it('leaves the language to the page: the utterance is not given one', () => {
    const { environment, utterances } = fakeSpeech();
    speak(environment, 'x', { onEnd: () => undefined });
    expect(utterances[0]).not.toHaveProperty('lang');
  });

  it('tells the caller when the reading ends by itself', () => {
    const { environment, utterances } = fakeSpeech();
    const onEnd = jest.fn();
    speak(environment, 'x', { onEnd });
    utterances[0]?.fire('end');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('tells the caller about a real failure', () => {
    const { environment, utterances } = fakeSpeech();
    const onEnd = jest.fn();
    speak(environment, 'x', { onEnd });
    utterances[0]?.fire('error', { error: 'synthesis-failed' });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not treat being stopped on purpose as an ending', () => {
    const { environment, utterances } = fakeSpeech();
    const onEnd = jest.fn();
    speak(environment, 'x', { onEnd });
    utterances[0]?.fire('error', { error: 'canceled' });
    utterances[0]?.fire('error', { error: 'interrupted' });
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('isStoppedOnPurpose', () => {
  it('is true for the two codes cancel() causes', () => {
    expect(isStoppedOnPurpose('canceled')).toBe(true);
    expect(isStoppedOnPurpose('interrupted')).toBe(true);
  });

  it('is false for every other error and for none', () => {
    expect(isStoppedOnPurpose('audio-busy')).toBe(false);
    expect(isStoppedOnPurpose(undefined)).toBe(false);
  });
});

describe('stopSpeaking', () => {
  it('cancels the synthesiser', () => {
    const cancel = jest.fn();
    stopSpeaking({ cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('browserSpeech', () => {
  it('is undefined where there is no window (the server, or a test)', () => {
    expect(browserSpeech()).toBeUndefined();
  });
});
