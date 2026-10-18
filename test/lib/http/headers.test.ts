import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SECURITY_HEADERS,
  applyResponseHeaders,
} from '../../../src/lib/http/headers';

const at = (pathname: string) =>
  new Request(`https://chowdown.test${pathname}`);
const html = (headers: Record<string, string> = {}) =>
  new Response('<p>hi</p>', {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });

describe('applyResponseHeaders', () => {
  it('adds the security headers to every response', async () => {
    const out = applyResponseHeaders(at('/app'), html());
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(out.headers.get(name)).toBe(value);
    }
    expect(await out.text()).toBe('<p>hi</p>');
  });

  it('keeps the security headers a route set itself', () => {
    const out = applyResponseHeaders(
      at('/oauth/authorize'),
      html({
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
      }),
    );
    expect(out.headers.get('X-Frame-Options')).toBe('DENY');
    expect(out.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'none'",
    );
  });

  it('lets personal pages be restored by the back button but never shared', () => {
    const out = applyResponseHeaders(
      at('/recipe/abc'),
      html({
        'Cache-Control':
          'private, no-cache, no-store, max-age=0, must-revalidate',
      }),
    );
    expect(out.headers.get('Cache-Control')).toBe('private, no-cache');
  });

  it('leaves the cache rules of the API and the sign-in pages alone', () => {
    const api = applyResponseHeaders(
      at('/api/recipes'),
      new Response('{}', {
        headers: {
          'content-type': 'application/json',
          'Cache-Control': 'private, max-age=0',
        },
      }),
    );
    expect(api.headers.get('Cache-Control')).toBe('private, max-age=0');
    const consent = applyResponseHeaders(
      at('/oauth/authorize'),
      html({ 'Cache-Control': 'no-store' }),
    );
    expect(consent.headers.get('Cache-Control')).toBe('no-store');
  });

  it('lets the manifest and icons be cached for a day', () => {
    for (const p of ['/manifest.webmanifest', '/icon.svg', '/apple-icon.png']) {
      const out = applyResponseHeaders(at(p), new Response('x'));
      expect(out.headers.get('Cache-Control')).toContain('max-age=86400');
    }
  });

  it('keeps the status of a redirect', () => {
    const out = applyResponseHeaders(
      at('/'),
      Response.redirect('https://chowdown.test/app', 307),
    );
    expect(out.status).toBe(307);
    expect(out.headers.get('Location')).toBe('https://chowdown.test/app');
  });
});

describe('public/_headers', () => {
  it('gives static files the same security headers as the Worker gives pages', () => {
    const file = readFileSync(
      path.join(process.cwd(), 'public/_headers'),
      'utf8',
    );
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(file).toContain(`${name}: ${value}`);
    }
  });
});
