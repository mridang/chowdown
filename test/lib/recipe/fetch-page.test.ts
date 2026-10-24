import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { USER_AGENT } from '@/lib/http/safe-fetch';
import { fetchPage, PageFetchError } from '@/lib/recipe/fetch-page';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

/** Make the next fetches answer with `responses`, in turn, and remember the calls. */
function serving(...responses: readonly Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  global.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[calls.length - 1];
    if (!next) {
      throw new Error('no more responses');
    }
    return next;
  }) as unknown as typeof fetch;
  return calls;
}

/** Why fetching `url` failed, in the words import shows. */
async function failure(url: string, timeoutMs?: number): Promise<string> {
  const error = await fetchPage(url, timeoutMs).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(PageFetchError);
  return (error as PageFetchError).failure;
}

describe('fetchPage', () => {
  it('returns the page body, introducing itself honestly', async () => {
    const calls = serving(
      new Response('<html>ok</html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
    await expect(fetchPage('https://a.com/x')).resolves.toBe('<html>ok</html>');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(USER_AGENT);
    expect(headers['User-Agent']).not.toMatch(/Mozilla/);
    expect(headers['Accept']).toContain('text/html');
  });

  it('decodes UTF-8', async () => {
    serving(new Response('<p>crème brûlée 🍮</p>'));
    await expect(fetchPage('https://a.com/x')).resolves.toBe(
      '<p>crème brûlée 🍮</p>',
    );
  });

  it('keeps at most 200,000 characters of a very large page', async () => {
    serving(new Response('x'.repeat(300_000)));
    expect((await fetchPage('https://a.com/x')).length).toBe(200_000);
  });

  it('stops reading a page that never ends instead of buffering it', async () => {
    const pulls = { count: 0 };
    serving(
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            pulls.count += 1;
            controller.enqueue(new Uint8Array(100_000).fill(120));
          },
        }),
      ),
    );
    expect((await fetchPage('https://a.com/x')).length).toBe(200_000);
    // 800,000 bytes is the limit: a handful of pulls, not the whole internet.
    expect(pulls.count).toBeLessThan(20);
  });

  it.each(['text/html', 'application/xhtml+xml', 'text/plain', ''])(
    'accepts a page served as %p',
    async (type) => {
      serving(
        new Response('<p>ok</p>', {
          headers: type ? { 'content-type': type } : {},
        }),
      );
      await expect(fetchPage('https://a.com/x')).resolves.toContain('ok');
    },
  );

  it.each([
    'application/pdf',
    'image/png',
    'application/octet-stream',
    'video/mp4',
  ])('refuses %s as not a web page', async (type) => {
    serving(new Response('bytes', { headers: { 'content-type': type } }));
    expect(await failure('https://a.com/x')).toBe('not a web page');
  });

  it('follows a redirect to another public page', async () => {
    const calls = serving(
      new Response(null, {
        status: 301,
        headers: { Location: 'https://b.com/y' },
      }),
      new Response('<p>there</p>'),
    );
    await expect(fetchPage('https://a.com/x')).resolves.toBe('<p>there</p>');
    expect(calls.map((c) => c.url)).toEqual([
      'https://a.com/x',
      'https://b.com/y',
    ]);
  });

  it('refuses a redirect to a host it should not reach', async () => {
    const calls = serving(
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1:8080/' },
      }),
      new Response('secret'),
    );
    expect(await failure('https://a.com/x')).toBe('blocked');
    expect(calls).toHaveLength(1);
  });

  it.each([
    'http://localhost/x',
    'http://127.0.0.1/x',
    'http://10.1.2.3/x',
    'https://a.com:8443/x',
    'https://user:pw@a.com/x',
    'file:///etc/passwd',
    'https://intranet/x',
  ])('refuses %s without a request', async (url) => {
    const calls = serving(new Response('x'));
    expect(await failure(url)).toBe('blocked');
    expect(calls).toHaveLength(0);
  });

  it('names a non-2xx response by its status', async () => {
    serving(new Response('blocked', { status: 403 }));
    expect(await failure('https://a.com/x')).toBe('fetch failed (403)');
  });

  it('says timed out when the site is too slow', async () => {
    global.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason),
        ),
      )) as unknown as typeof fetch;
    expect(await failure('https://a.com/x', 20)).toBe('timed out');
  });

  it('says unreachable when the request fails outright', async () => {
    const spy = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    global.fetch = spy as unknown as typeof fetch;
    expect(await failure('https://a.com/x')).toBe('unreachable');
  });
});

describe('PageFetchError', () => {
  it('carries the failure as its message', () => {
    const error = new PageFetchError('timed out');
    expect(error.message).toBe('timed out');
    expect(error.name).toBe('PageFetchError');
  });
});
