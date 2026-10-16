import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchPage } from '../../../src/lib/recipe/fetch-page';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

describe('fetchPage', () => {
  it('returns the page body with a browser-like user agent', async () => {
    const spy = jest.fn(async () => new Response('<html>ok</html>'));
    global.fetch = spy as unknown as typeof fetch;
    await expect(fetchPage('https://a.com/x')).resolves.toBe('<html>ok</html>');
    const init = (spy.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(
      /Mozilla/,
    );
  });

  it('truncates very large pages', async () => {
    global.fetch = (async () =>
      new Response('x'.repeat(300_000))) as unknown as typeof fetch;
    expect((await fetchPage('https://a.com/x')).length).toBe(200_000);
  });

  it('throws on a non-2xx response', async () => {
    global.fetch = (async () =>
      new Response('blocked', { status: 403 })) as unknown as typeof fetch;
    await expect(fetchPage('https://a.com/x')).rejects.toThrow('403');
  });
});
