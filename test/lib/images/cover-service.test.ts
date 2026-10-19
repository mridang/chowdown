import { describe, expect, it, jest } from '@jest/globals';

import type { CoverFetch } from '../../../src/lib/images/cover-proxy';
import {
  coverCacheKey,
  serveCover,
  withBrowserCaching,
  type CoverCache,
} from '../../../src/lib/images/cover-service';

const PHOTO = 'https://photos.example.org/soup.jpg';

/** A fetcher that serves a small JPEG. */
const serving: CoverFetch = async () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-type': 'image/jpeg' },
  });

/** Everyone may have every photo (the ownership rule has its own tests). */
const allowed = async () => true;

/** A cache that remembers what it is given. */
function fakeCache(initial: Response | undefined = undefined) {
  const stored: [string, Response][] = [];
  const cache: CoverCache = {
    match: async () => initial,
    put: async (key, response) => {
      stored.push([key instanceof Request ? key.url : String(key), response]);
    },
  };
  return { cache, stored };
}

describe('coverCacheKey', () => {
  it('depends on the width and the photo, not on who asks', () => {
    expect(coverCacheKey(640, PHOTO).url).toBe(
      `https://covers.chowdown.invalid/640/${encodeURIComponent(PHOTO)}`,
    );
    expect(coverCacheKey(320, PHOTO).url).not.toBe(
      coverCacheKey(640, PHOTO).url,
    );
  });
});

describe('withBrowserCaching', () => {
  it('lets only the browser keep the image, for a week', async () => {
    const response = withBrowserCaching(
      new Response('x', { headers: { 'content-type': 'image/png' } }),
    );
    expect(response.headers.get('cache-control')).toBe(
      'private, max-age=604800, immutable',
    );
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(await response.text()).toBe('x');
  });
});

describe('serveCover', () => {
  it('refuses an address that is not a public image with 400', async () => {
    const response = await serveCover('http://localhost/x.png', 640, {
      background: () => undefined,
      mayFetch: allowed,
    });
    expect(response.status).toBe(400);
  });

  it('answers from the edge cache without fetching', async () => {
    const fetcher = jest.fn(serving);
    const { cache } = fakeCache(
      new Response('cached', { headers: { 'content-type': 'image/webp' } }),
    );
    const response = await serveCover(PHOTO, 640, {
      cache,
      fetcher,
      background: () => undefined,
      mayFetch: allowed,
    });
    expect(await response.text()).toBe('cached');
    expect(fetcher).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('private');
  });

  it('fetches the photo, keeps a copy at the edge in the background, and sends it', async () => {
    const { cache, stored } = fakeCache();
    const background = jest.fn((work: Promise<unknown>) => work);
    const response = await serveCover(PHOTO, 640, {
      cache,
      fetcher: serving,
      background,
      mayFetch: allowed,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe(
      'private, max-age=604800, immutable',
    );
    expect(background).toHaveBeenCalledTimes(1);
    await background.mock.results[0]?.value;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.[0]).toBe(coverCacheKey(640, PHOTO).url);
  });

  it('works without any cache', async () => {
    const background = jest.fn();
    const response = await serveCover(PHOTO, 640, {
      fetcher: serving,
      background,
      mayFetch: allowed,
    });
    expect(response.status).toBe(200);
    expect(background).not.toHaveBeenCalled();
  });

  it('answers 404 when the photo is gone', async () => {
    const gone: CoverFetch = async () => new Response('', { status: 404 });
    const response = await serveCover(PHOTO, 640, {
      fetcher: gone,
      background: () => undefined,
      mayFetch: allowed,
    });
    expect(response.status).toBe(404);
  });

  it('answers 502 when its site cannot be reached', async () => {
    const down: CoverFetch = async () => {
      throw new Error('offline');
    };
    const response = await serveCover(PHOTO, 640, {
      fetcher: down,
      background: () => undefined,
      mayFetch: allowed,
    });
    expect(response.status).toBe(502);
  });

  it('refuses a photo the person has no recipe for, without fetching it', async () => {
    const fetcher = jest.fn(serving);
    const asked: string[] = [];
    const response = await serveCover(PHOTO, 640, {
      fetcher,
      background: () => undefined,
      mayFetch: async (url) => {
        asked.push(url);
        return false;
      },
    });
    expect(response.status).toBe(404);
    expect(asked).toEqual([PHOTO]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not ask about a photo the edge already has', async () => {
    const mayFetch = jest.fn(async () => false);
    const { cache } = fakeCache(
      new Response('cached', { headers: { 'content-type': 'image/webp' } }),
    );
    const response = await serveCover(PHOTO, 640, {
      cache,
      background: () => undefined,
      mayFetch,
    });
    expect(response.status).toBe(200);
    expect(mayFetch).not.toHaveBeenCalled();
  });

  it('does not ask about an address that is not a public image', async () => {
    const mayFetch = jest.fn(async () => true);
    await serveCover('http://127.0.0.1/x.png', 640, {
      background: () => undefined,
      mayFetch,
    });
    expect(mayFetch).not.toHaveBeenCalled();
  });
});
