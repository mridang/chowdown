import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type Listener = (event: never) => void;

/** What the worker did with a fetch event. */
type Handled = { answered: boolean; response: Promise<Response> | null };

/**
 * Runs `public/sw.js` in a context shaped like a service worker scope, with a
 * network that either works (`online`) or fails, and a browser that does or
 * does not support navigation preload. Returns the listeners it registered.
 */
function loadWorker(options: { online: boolean; preload: boolean }) {
  const listeners = new Map<string, Listener>();
  const calls = { preloadEnabled: 0, claimed: 0, skipped: 0 };
  const self = {
    addEventListener: (type: string, listener: Listener) =>
      listeners.set(type, listener),
    skipWaiting: () => {
      calls.skipped += 1;
    },
    clients: {
      claim: async () => {
        calls.claimed += 1;
      },
    },
    registration: {
      navigationPreload: options.preload
        ? {
            enable: async () => {
              calls.preloadEnabled += 1;
            },
          }
        : undefined,
    },
  };
  const context = vm.createContext({
    self,
    Response,
    Promise,
    fetch: async () => {
      if (!options.online) {
        throw new TypeError('offline');
      }
      return new Response('from the network');
    },
  });
  vm.runInContext(
    readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8'),
    context,
  );
  return { listeners, calls };
}

/** Fires a fetch event and reports whether the worker answered it. */
function fetchEvent(
  listeners: Map<string, Listener>,
  mode: string,
  preloadResponse: Promise<Response | undefined> = Promise.resolve(undefined),
): Handled {
  const answers: Promise<Response>[] = [];
  const event = {
    request: { mode },
    preloadResponse,
    respondWith: (response: Promise<Response>) => answers.push(response),
  };
  listeners.get('fetch')?.(event as never);
  return { answered: answers.length > 0, response: answers[0] ?? null };
}

describe('public/sw.js', () => {
  it('listens for install, activate and fetch', () => {
    const { listeners } = loadWorker({ online: true, preload: true });
    expect([...listeners.keys()].toSorted()).toEqual([
      'activate',
      'fetch',
      'install',
    ]);
  });

  it('takes over straight away on install', () => {
    const { listeners, calls } = loadWorker({ online: true, preload: true });
    listeners.get('install')?.({} as never);
    expect(calls.skipped).toBe(1);
  });

  it('claims open pages and turns on navigation preload when the browser has it', async () => {
    const { listeners, calls } = loadWorker({ online: true, preload: true });
    const waited: Promise<unknown>[] = [];
    listeners.get('activate')?.({
      waitUntil: (p: Promise<unknown>) => waited.push(p),
    } as never);
    await Promise.all(waited);
    expect(calls).toMatchObject({ claimed: 1, preloadEnabled: 1 });
  });

  it('still activates in a browser without navigation preload', async () => {
    const { listeners, calls } = loadWorker({ online: true, preload: false });
    const waited: Promise<unknown>[] = [];
    listeners.get('activate')?.({
      waitUntil: (p: Promise<unknown>) => waited.push(p),
    } as never);
    await Promise.all(waited);
    expect(calls).toMatchObject({ claimed: 1, preloadEnabled: 0 });
  });

  it('does not answer anything but page navigations', () => {
    const { listeners } = loadWorker({ online: false, preload: true });
    for (const mode of ['cors', 'no-cors', 'same-origin']) {
      expect(fetchEvent(listeners, mode).answered).toBe(false);
    }
  });

  it('uses the preloaded response when there is one', async () => {
    const { listeners } = loadWorker({ online: false, preload: true });
    const handled = fetchEvent(
      listeners,
      'navigate',
      Promise.resolve(new Response('preloaded')),
    );
    expect(await (await handled.response)?.text()).toBe('preloaded');
  });

  it('fetches the page itself when nothing was preloaded', async () => {
    const { listeners } = loadWorker({ online: true, preload: false });
    const handled = fetchEvent(listeners, 'navigate');
    expect(await (await handled.response)?.text()).toBe('from the network');
  });

  it('says it is offline, with a 503 page, when the network fails', async () => {
    const { listeners } = loadWorker({ online: false, preload: false });
    const response = await fetchEvent(listeners, 'navigate').response;
    expect(response?.status).toBe(503);
    expect(response?.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    expect(await response?.text()).toContain("You're offline");
  });

  it('gives the offline page an icon, the brand colour and a retry button', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'public/sw.js'),
      'utf8',
    );
    expect(source).toContain('<link rel="icon" href="/icon.svg"');
    expect(source).toContain('#ffb100');
    expect(source).toContain('location.reload()');
  });
});
