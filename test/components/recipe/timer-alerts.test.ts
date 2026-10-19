import { describe, expect, it, jest } from '@jest/globals';

import {
  BEEP_OFFSETS,
  createAlarm,
  finishedAnnouncement,
  finishedMessage,
  setPageTitle,
  titleForFinished,
  VIBRATION_PATTERN,
  vibrateOnFinish,
} from '../../../src/components/recipe/timer-alerts';

/** A stand-in audio context that records what the beep asks of it. */
function fakeContext(options: { readonly refuse?: boolean } = {}) {
  const calls: string[] = [];
  const param = (name: string) => ({
    setValueAtTime: (value: number, at: number) =>
      calls.push(`${name}.set(${value},${at})`),
    exponentialRampToValueAtTime: (value: number, at: number) =>
      calls.push(`${name}.ramp(${value},${at})`),
  });
  const context = {
    currentTime: 10,
    destination: {},
    resume: jest.fn(async () => {
      if (options.refuse) {
        throw new Error('blocked');
      }
    }),
    close: jest.fn(async () => undefined),
    createOscillator: () => ({
      frequency: param('freq'),
      connect: () => calls.push('osc.connect'),
      start: (at: number) => calls.push(`osc.start(${at})`),
      stop: (at: number) => calls.push(`osc.stop(${at})`),
    }),
    createGain: () => ({
      gain: param('gain'),
      connect: () => calls.push('gain.connect'),
    }),
  };
  return { context, calls };
}

/** A constructor that hands back the given context, as `AudioContext` would. */
function constructing(context: object): never {
  return function () {
    return context;
  } as never;
}

const settled = () => new Promise((done) => setTimeout(done, 0));

describe('createAlarm', () => {
  it('gives no alarm where the browser has no audio', () => {
    expect(createAlarm(undefined)).toBeUndefined();
  });

  it('makes its audio context straight away, from the tap, and resumes it', () => {
    const { context } = fakeContext();
    const Context = jest.fn(function () {
      return context;
    });
    createAlarm(Context as never);
    expect(Context).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalled();
  });

  it('plays three beeps, each starting at its own time', async () => {
    const { context, calls } = fakeContext();
    createAlarm(constructing(context))?.ring();
    await settled();
    const starts = calls.filter((c) => c.startsWith('osc.start'));
    expect(starts).toEqual(BEEP_OFFSETS.map((o) => `osc.start(${10 + o})`));
  });

  it('shapes each beep so it fades in and out', async () => {
    const { context, calls } = fakeContext();
    createAlarm(constructing(context))?.ring();
    await settled();
    expect(calls.filter((c) => c.startsWith('gain.ramp'))).toHaveLength(
      BEEP_OFFSETS.length * 2,
    );
    expect(calls).toContain('freq.set(880,10)');
  });

  it('stays silent, without error, if the browser will not resume the audio', async () => {
    const { context, calls } = fakeContext({ refuse: true });
    const alarm = createAlarm(constructing(context));
    expect(() => alarm?.ring()).not.toThrow();
    await settled();
    expect(calls).toEqual([]);
  });

  it('closes the audio context when asked', () => {
    const { context } = fakeContext();
    createAlarm(constructing(context))?.close();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});

describe('vibrateOnFinish', () => {
  it('buzzes with the pattern where the browser can', () => {
    const vibrate = jest.fn<(pattern: number[]) => boolean>(() => true);
    vibrateOnFinish({ vibrate });
    expect(vibrate).toHaveBeenCalledWith([...VIBRATION_PATTERN]);
  });

  it('does nothing where there is no vibration (Safari)', () => {
    expect(() => vibrateOnFinish({})).not.toThrow();
  });
});

describe('announcements', () => {
  it('names the step, counting from one', () => {
    expect(finishedMessage({ step: 2 })).toBe('Timer for step 3 finished');
  });

  it('joins several that finish together', () => {
    expect(finishedAnnouncement([{ step: 0 }, { step: 3 }])).toBe(
      'Timer for step 1 finished. Timer for step 4 finished',
    );
  });

  it('is empty for none', () => {
    expect(finishedAnnouncement([])).toBe('');
  });
});

describe('titleForFinished', () => {
  it('is null when nothing is waiting', () => {
    expect(titleForFinished([], 'Dal')).toBeNull();
  });

  it('names the step for one timer and keeps the recipe in the title', () => {
    expect(titleForFinished([{ step: 2 }], 'Dal')).toBe(
      'Timer done (step 3) - Dal',
    );
  });

  it('counts several', () => {
    expect(titleForFinished([{ step: 0 }, { step: 1 }], 'Dal')).toBe(
      '2 timers done - Dal',
    );
  });
});

describe('setPageTitle', () => {
  it('replaces the text of the title element', () => {
    const replaceChildren = jest.fn();
    setPageTitle({ querySelector: () => ({ replaceChildren }) }, 'Done');
    expect(replaceChildren).toHaveBeenCalledWith('Done');
  });

  it('does nothing on a page with no title element', () => {
    expect(() =>
      setPageTitle({ querySelector: () => null }, 'Done'),
    ).not.toThrow();
  });
});
