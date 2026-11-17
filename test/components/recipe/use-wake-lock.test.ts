import { describe, expect, it, jest } from '@jest/globals';

import {
  keepScreenAwake,
  shouldRequestLock,
} from '@/components/recipe/use-wake-lock';
import type { WakeLockEnvironment } from '@/components/recipe/use-wake-lock';

/** A wake lock sentinel that can be released by the "browser" as well as by the page. */
function fakeSentinel() {
  const addEventListener = jest.fn(
    (_type: string, _listener: () => void) => undefined,
  );
  const listeners = () =>
    addEventListener.mock.calls.map(([, listener]) => listener);
  const release = jest.fn(async () => {
    for (const listener of listeners()) {
      listener();
    }
  });
  return {
    sentinel: { release, addEventListener },
    release,
    /** What the browser does when the page is hidden. */
    browserReleases: () => {
      for (const listener of listeners()) {
        listener();
      }
    },
  };
}

/** A page whose visibility the test controls, with a wake lock that hands out `fakeSentinel`s. */
function fakePage(
  options: { readonly refuse?: boolean; readonly visible?: boolean } = {},
) {
  const makeSentinel =
    jest.fn<() => ReturnType<typeof fakeSentinel>>(fakeSentinel);
  const isVisible = jest.fn(() => options.visible ?? true);
  const onVisibilityChange = jest.fn((_watcher: () => void) => () => undefined);
  const watchers = () =>
    onVisibilityChange.mock.calls.map(([watcher]) => watcher);
  const made = () =>
    makeSentinel.mock.results.flatMap((result) =>
      result.type === 'return' ? [result.value] : [],
    );
  const request = jest.fn(async (...args: readonly ['screen']) => {
    expect(args).toEqual(['screen']);
    if (options.refuse) {
      throw new Error('denied');
    }
    return makeSentinel().sentinel;
  });
  const environment: WakeLockEnvironment = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the fake WakeLock has only `request`, and its sentinel only release and addEventListener, which is all the keeper calls
    wakeLock: { request } as never,
    isVisible,
    onVisibilityChange,
  };
  return {
    environment,
    request,
    get sentinels() {
      return made();
    },
    /** The tab is hidden: the browser takes the lock back. */
    hide: () => {
      isVisible.mockReturnValue(false);
      for (const sentinel of made()) {
        sentinel.browserReleases();
      }
      for (const watcher of watchers()) {
        watcher();
      }
    },
    /** The tab is shown again. */
    show: () => {
      isVisible.mockReturnValue(true);
      for (const watcher of watchers()) {
        watcher();
      }
    },
  };
}

const settled = async () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

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
    expect(page.request.mock.calls).toEqual([]);
  });

  it('asks again when the page is shown after being hidden', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    page.hide();
    await settled();
    expect(page.request.mock.calls).toHaveLength(1);
    page.show();
    await settled();
    expect(page.request.mock.calls).toHaveLength(2);
  });

  it('keeps going through many hides and shows', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    for (const cycle of [1, 2, 3]) {
      page.hide();
      page.show();
      await settled();
      expect(page.request.mock.calls).toHaveLength(cycle + 1);
    }
    expect(page.request.mock.calls).toHaveLength(4);
  });

  it('does not ask twice when the page is shown while a request is in flight', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    page.show();
    page.show();
    await settled();
    expect(page.request.mock.calls).toHaveLength(1);
  });

  it('does not ask again while a lock is still held', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    page.show();
    expect(page.request.mock.calls).toHaveLength(1);
  });

  it('asks again if the lock is released for another reason while visible', async () => {
    const page = fakePage();
    keepScreenAwake(page.environment);
    await settled();
    page.sentinels[0]?.browserReleases();
    await settled();
    expect(page.request.mock.calls).toHaveLength(2);
  });

  it('lets the screen sleep when stopped', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.environment);
    await settled();
    stop();
    expect(page.sentinels[0]?.release.mock.calls).toEqual([[]]);
  });

  it('gives a lock straight back if stopped before it was granted', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.environment);
    stop();
    await settled();
    expect(page.sentinels[0]?.release.mock.calls).toEqual([[]]);
  });

  it('does not ask again after being stopped, even if the page is shown', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.environment);
    await settled();
    stop();
    await settled();
    page.show();
    await settled();
    expect(page.request.mock.calls).toHaveLength(1);
  });

  it('is silent when the browser refuses, and tries again at the next chance', async () => {
    const page = fakePage({ refuse: true });
    expect(() => keepScreenAwake(page.environment)).not.toThrow();
    await settled();
    page.show();
    await settled();
    expect(page.request.mock.calls).toHaveLength(2);
  });

  it('does nothing, and stops without error, in a browser with no wake lock', () => {
    // eslint-disable-next-line no-unassigned-vars -- never assigned on purpose: it stands for an environment with no wake lock, and writing undefined inline is reported by sonarjs/no-undefined-assignment
    let wakeLock: WakeLockEnvironment['wakeLock'];
    const stop = keepScreenAwake({
      wakeLock,
      isVisible: () => true,
      onVisibilityChange: () => () => undefined,
    });
    expect(() => stop()).not.toThrow();
  });
});
