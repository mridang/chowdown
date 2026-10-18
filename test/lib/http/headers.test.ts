import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SECURITY_HEADERS,
  applyResponseHeaders,
  resourcePolicyFor,
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

describe('Cross-Origin-Resource-Policy', () => {
  it('keeps pages and data to this site', () => {
    for (const path of [
      '/',
      '/app',
      '/recipe/abc',
      '/api/recipes',
      '/connect',
    ]) {
      expect(resourcePolicyFor(path)).toBe('same-site');
    }
  });

  it('opens the files other sites embed or fetch on purpose', () => {
    for (const path of [
      '/opengraph-image.png',
      '/twitter-image.png',
      '/icon.svg',
      '/apple-icon.png',
      '/manifest.webmanifest',
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/icons/icon-192.png',
      '/.well-known/security.txt',
      '/.well-known/oauth-authorization-server',
    ]) {
      expect(resourcePolicyFor(path)).toBe('cross-origin');
    }
  });

  it('is sent on every response, and a route may set its own', () => {
    expect(
      applyResponseHeaders(at('/app'), html()).headers.get(
        'Cross-Origin-Resource-Policy',
      ),
    ).toBe('same-site');
    expect(
      applyResponseHeaders(at('/icon.svg'), html()).headers.get(
        'Cross-Origin-Resource-Policy',
      ),
    ).toBe('cross-origin');
    expect(
      applyResponseHeaders(
        at('/app'),
        html({ 'Cross-Origin-Resource-Policy': 'same-origin' }),
      ).headers.get('Cross-Origin-Resource-Policy'),
    ).toBe('same-origin');
  });
});

describe('Strict-Transport-Security', () => {
  it('lasts two years, covers subdomains and asks to be preloaded', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });
});

describe('X-Robots-Tag', () => {
  it('keeps crawlers out of every page except the two public ones', () => {
    for (const path of [
      '/app',
      '/recipe/abc',
      '/connect',
      '/recipes/add',
      '/api/recipes',
      '/oauth/authorize',
    ]) {
      expect(
        applyResponseHeaders(at(path), html()).headers.get('X-Robots-Tag'),
      ).toBe('noindex, nofollow');
    }
    for (const path of ['/', '/privacy']) {
      expect(
        applyResponseHeaders(at(path), html()).headers.get('X-Robots-Tag'),
      ).toBeNull();
    }
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
