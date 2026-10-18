import { describe, expect, it } from '@jest/globals';

import {
  coverSrc,
  coverSrcSet,
  fetchCover,
  isFetchableImageUrl,
  snapWidth,
  type CoverFetch,
} from '../../../src/lib/images/cover-proxy';

const image = (type = 'image/jpeg', headers: Record<string, string> = {}) =>
  new Response('bytes', { headers: { 'content-type': type, ...headers } });
const returning =
  (res: Response): CoverFetch =>
  async () =>
    res;

describe('widths and addresses', () => {
  it('snaps a width up to one we offer', () => {
    expect(snapWidth(1)).toBe(320);
    expect(snapWidth(481)).toBe(640);
    expect(snapWidth(5000)).toBe(1280);
  });

  it('builds our own address for a photo', () => {
    expect(coverSrc('https://a.com/x y.jpg?v=1&w=2', 500)).toBe(
      '/api/cover-images?url=https%3A%2F%2Fa.com%2Fx%20y.jpg%3Fv%3D1%26w%3D2&w=640',
    );
  });

  it('builds a srcset with each width', () => {
    const set = coverSrcSet('https://a.com/x.jpg', [320, 640]);
    expect(set).toContain('&w=320 320w');
    expect(set).toContain('&w=640 640w');
  });
});

describe('isFetchableImageUrl', () => {
  it.each([
    'https://thewoksoflife.com/wp-content/uploads/a.jpg',
    'http://www.site.co.uk/a.png',
    'https://cdn.example-food.com:443/a.webp',
  ])('accepts %s', (url) => {
    expect(isFetchableImageUrl(url)).toBe(true);
  });

  it.each([
    'file:///etc/passwd',
    'ftp://a.com/x.jpg',
    'javascript:alert(1)',
    'https://localhost/x.jpg',
    'http://127.0.0.1/x.jpg',
    'http://10.0.0.5/x.jpg',
    'http://192.168.1.1/x.jpg',
    'http://172.20.0.1/x.jpg',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/x.jpg',
    'http://2130706433/x.jpg',
    'https://intranet/x.jpg',
    'https://printer.local/x.jpg',
    'https://a.com:8080/x.jpg',
    'https://user:pw@a.com/x.jpg',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(isFetchableImageUrl(url)).toBe(false);
  });
});

describe('fetchCover', () => {
  it('passes a photo through, sealed and cacheable', async () => {
    const result = await fetchCover(
      'https://a.com/x.jpg',
      640,
      returning(image()),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.headers.get('content-type')).toBe('image/jpeg');
      expect(result.response.headers.get('content-security-policy')).toContain(
        'sandbox',
      );
      expect(result.response.headers.get('cache-control')).toContain(
        'immutable',
      );
      expect(await result.response.text()).toBe('bytes');
    }
  });

  it('asks Cloudflare to scale it to the width', async () => {
    let seen: RequestInit | undefined;
    await fetchCover('https://a.com/x.jpg', 700, async (_url, init) => {
      seen = init;
      return image();
    });
    expect(
      (seen as { cf?: { image?: { width?: number } } }).cf?.image?.width,
    ).toBe(960);
  });

  it('falls back to the original when scaling is not available', async () => {
    const seen: (unknown | undefined)[] = [];
    const result = await fetchCover(
      'https://a.com/x.jpg',
      640,
      async (_url, init) => {
        const cf = (init as { cf?: { image?: unknown } }).cf;
        seen.push(cf?.image);
        return cf?.image ? new Response('no', { status: 403 }) : image();
      },
    );
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBeUndefined();
  });

  it('refuses an address it should not fetch, without fetching', async () => {
    let called = false;
    const result = await fetchCover('http://127.0.0.1/x.jpg', 640, async () => {
      called = true;
      return image();
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(called).toBe(false);
  });

  it.each([
    ['an HTML page', image('text/html'), 415],
    ['an SVG, which can carry script', image('image/svg+xml'), 415],
    [
      'a photo that is too large',
      image('image/png', { 'content-length': String(50 * 1024 * 1024) }),
      413,
    ],
    ['a missing photo', new Response('', { status: 404 }), 404],
    ['a refusal', new Response('', { status: 403 }), 502],
  ])('rejects %s', async (_name, response, status) => {
    expect(
      await fetchCover('https://a.com/x', 640, returning(response)),
    ).toMatchObject({
      ok: false,
      status,
    });
  });

  it('reports a site that does not answer', async () => {
    const result = await fetchCover('https://a.com/x.jpg', 640, async () => {
      throw new Error('timeout');
    });
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
