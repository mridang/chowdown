import { describe, expect, it, jest } from '@jest/globals';

import {
  keepScreenAwake,
  shouldRequestLock,
  type WakeLockEnvironment,
} from '@/components/recipe/use-wake-lock';

/** A wake lock sentinel that can be released by the "browser" as well as by the page. */
function fakeSentinel() {
  const listeners: Array<() => void> = [];
  const release = jest.fn(async () => {
    listeners.forEach((listener) => listener());
  });
  return {
    sentinel: {
      release,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.push(listener);
      },
    },
    release,
    /** What the browser does when the page is hidden. */
    browserReleases: () => listeners.forEach((listener) => listener()),
  };
}

/** A page whose visibility the test controls, with a wake lock that hands out `fakeSentinel`s. */
function fakePage(
  options: { readonly refuse?: boolean; readonly visible?: boolean } = {},
) {
  const sentinels: ReturnType<typeof fakeSentinel>[] = [];
  const watchers: Array<() => void> = [];
  const state = { visible: options.visible ?? true };
  const request = jest.fn(async (...args: readonly ['screen']) => {
    expect(args).toEqual(['screen']);
    if (options.refuse) {
      throw new Error('denied');
    }
    const made = fakeSentinel();
    sentinels.push(made);
    return made.sentinel;
  });
  const environment: WakeLockEnvironment = {
    wakeLock: { request } as never,
    isVisible: () => state.visible,
    onVisibilityChange: (callback) => {
      watchers.push(callback);
      return () => undefined;
    },
  };
  return {
    environment,
    request,
    sentinels,
    /** The tab is hidden: the browser takes the lock back. */
    hide: () => {
      Object.assign(state, { visible: false });
      sentinels.forEach((made) => made.browserReleases());
      watchers.forEach((watcher) => watcher());
    },
    /** The tab is shown again. */
    show: () => {
      Object.assign(state, { visible: true });
      watchers.forEach((watcher) => watcher());
    },
  };
}

const settled = () => new Promise((done) => setTimeout(done, 0));

describe('shouldRequestLock', () => {
  it('asks only when idle and visible', () => {
    expect(shouldRequestLock('idle', true)).toBe(true);
    expect(shouldRequestLock('idle', false)).toBe(false);
    expect(shouldRequestLock('requesting', true)).toBe(false);
    expect(shouldRequestLock('held', true)).toBe(false);
    expect(shouldRequestLock('stopped', true)).toBe(false);
  });
});

describe('keepScreenAwake', () => {
  it('asks for a screen lock straight away', () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    expect(page.request).toHaveBeenCalledWith('screen');
  });

  it('does not ask while the page is hidden', () => {
    const page = fakePage({ visible: false });
    keepScreenAwake(page.environment);
    expect(page.request).not.toHaveBeenCalled();
  });

  it('asks again when the page is shown after being hidden', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    page.hide();
    await settled();
    expect(page.request).toHaveBeenCalledTimes(1);
    page.show();
    await settled();
    expect(page.request).toHaveBeenCalledTimes(2);
  });

  it('keeps going through many hides and shows', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    for (const cycle of [1, 2, 3]) {
      page.hide();
      page.show();
      await settled();
      expect(page.request).toHaveBeenCalledTimes(cycle + 1);
    }
    expect(page.request).toHaveBeenCalledTimes(4);
  });

  it('does not ask twice when the page is shown while a request is in flight', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    page.show();
    page.show();
    await settled();
    expect(page.request).toHaveBeenCalledTimes(1);
  });

  it('does not ask again while a lock is still held', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    page.show();
    expect(page.request).toHaveBeenCalledTimes(1);
  });

  it('asks again if the lock is released for another reason while visible', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    page.sentinels[0]?.browserReleases();
    await settled();
    expect(page.request).toHaveBeenCalledTimes(2);
  });

  it('lets the screen sleep when stopped', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.environment);
    await settled();
    stop();
    expect(page.sentinels[0]?.release).toHaveBeenCalledTimes(1);
  });

  it('gives a lock straight back if stopped before it was granted', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.environment);
    stop();
    await settled();
    expect(page.sentinels[0]?.release).toHaveBeenCalledTimes(1);
  });

  it('does not ask again after being stopped, even if the page is shown', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.environment);
    await settled();
    stop();
    await settled();
    page.show();
    await settled();
    expect(page.request).toHaveBeenCalledTimes(1);
  });

  it('is silent when the browser refuses, and tries again at the next chance', async () => {
    const page = fakePage({ refuse: true });
    expect(() => keepScreenAwake(page.environment)).not.toThrow();
    await settled();
    page.show();
    await settled();
    expect(page.request).toHaveBeenCalledTimes(2);
  });

  it('does nothing, and stops without error, in a browser with no wake lock', () => {
    const stop = keepScreenAwake({
      wakeLock: undefined,
      isVisible: () => true,
      onVisibilityChange: () => () => undefined,
    });
    expect(() => stop()).not.toThrow();
  });
});
