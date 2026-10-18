import { describe, expect, it } from '@jest/globals';

import {
  brotliResponse,
  isBuiltAsset,
  precompressedUrl,
} from '../../../src/lib/http/precompressed';

const req = (
  path: string,
  headers: Record<string, string> = {},
  method = 'GET',
) => new Request(`https://chowdown.test${path}`, { method, headers });

describe('isBuiltAsset', () => {
  it('recognises built scripts and styles only', () => {
    expect(isBuiltAsset(req('/_next/static/chunks/abc.js'))).toBe(true);
    expect(isBuiltAsset(req('/_next/static/chunks/abc.css'))).toBe(true);
    expect(isBuiltAsset(req('/_next/static/media/font.woff2'))).toBe(false);
    expect(isBuiltAsset(req('/app'))).toBe(false);
    expect(isBuiltAsset(req('/_next/static/chunks/abc.js.map'))).toBe(false);
  });
});

describe('precompressedUrl', () => {
  const asset = '/_next/static/chunks/abc.js';

  it('points a brotli-capable browser at the .br copy', () => {
    const url = precompressedUrl(
      req(`${asset}?v=1`, { 'accept-encoding': 'gzip, deflate, br, zstd' }),
    );
    expect(url?.pathname).toBe(`${asset}.br`);
    expect(url?.search).toBe('');
  });

  it('leaves a browser without brotli on the plain file', () => {
    expect(
      precompressedUrl(req(asset, { 'accept-encoding': 'gzip' })),
    ).toBeNull();
    expect(precompressedUrl(req(asset))).toBeNull();
  });

  it('respects "br;q=0"', () => {
    expect(
      precompressedUrl(req(asset, { 'accept-encoding': 'gzip, br;q=0' })),
    ).toBeNull();
    expect(
      precompressedUrl(req(asset, { 'accept-encoding': 'br;q=0.5' }))?.pathname,
    ).toBe(`${asset}.br`);
  });

  it('only for reads of built scripts and styles', () => {
    const br = { 'accept-encoding': 'br' };
    expect(precompressedUrl(req(asset, br, 'POST'))).toBeNull();
    expect(precompressedUrl(req('/_next/static/media/a.woff2', br))).toBeNull();
    expect(precompressedUrl(req(asset, br, 'HEAD'))?.pathname).toBe(
      `${asset}.br`,
    );
  });
});

describe('precompressedUrl — behind Cloudflare', () => {
  it('trusts the browser’s own Accept-Encoding over the normalised header', () => {
    const request = req('/_next/static/chunks/abc.js', {
      'accept-encoding': 'br, gzip',
    });
    Object.defineProperty(request, 'cf', {
      value: { clientAcceptEncoding: 'gzip, deflate' },
    });
    expect(precompressedUrl(request)).toBeNull();
    const modern = req('/_next/static/chunks/abc.js');
    Object.defineProperty(modern, 'cf', {
      value: { clientAcceptEncoding: 'gzip, deflate, br, zstd' },
    });
    expect(precompressedUrl(modern)?.pathname).toBe(
      '/_next/static/chunks/abc.js.br',
    );
  });
});

describe('brotliResponse', () => {
  const copy = () =>
    new Response('packed', {
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': '6',
      },
    });

  it('labels the copy with its real type and encoding, cached for a year', async () => {
    const res = brotliResponse(req('/_next/static/chunks/abc.js'), copy())!;
    expect(res.headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    );
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('cache-control')).toContain('no-transform');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    expect(await res.text()).toBe('packed');
  });

  it('knows styles', () => {
    const res = brotliResponse(req('/_next/static/chunks/abc.css'), copy())!;
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
  });

  it('falls back when there is no copy', () => {
    expect(
      brotliResponse(
        req('/_next/static/chunks/abc.js'),
        new Response('', { status: 404 }),
      ),
    ).toBeNull();
  });

  it('sends no body for a HEAD request', async () => {
    const res = brotliResponse(
      req('/_next/static/chunks/abc.js', {}, 'HEAD'),
      copy(),
    )!;
    expect(await res.text()).toBe('');
  });
});
