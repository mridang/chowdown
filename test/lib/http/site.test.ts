import { describe, expect, it } from '@jest/globals';

import {
  CACHED_QUERY_PARAMS,
  EDGE_CACHED_PAGES,
  EDGE_TTL_SECONDS,
  EXTRA_DIRECTIVES,
  EXTRA_IMG_SOURCES,
  OPEN_FILES,
  PUBLIC_PAGES,
  RARELY_CHANGING,
} from '@/lib/http/site';

describe('site settings', () => {
  it('lets the edge keep the same pages that may be indexed', () => {
    expect([...EDGE_CACHED_PAGES]).toEqual([...PUBLIC_PAGES]);
  });

  it('lets a kept page carry no query string', () => {
    expect([...CACHED_QUERY_PARAMS]).toEqual([]);
  });

  it('keeps a copy for five minutes', () => {
    expect(EDGE_TTL_SECONDS).toBe(300);
  });

  it('lets search engines index only the front page and the privacy page', () => {
    expect([...PUBLIC_PAGES]).toEqual(['/', '/privacy']);
  });

  it.each([
    '/opengraph-image.png',
    '/twitter-image.png',
    '/icon.svg',
    '/apple-icon.png',
    '/favicon.ico',
    '/manifest.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/security-policy.txt',
    '/icons/icon-192.png',
    '/screenshots/wide.png',
    '/.well-known/security.txt',
    '/.well-known/oauth-authorization-server',
  ])('opens %s to other sites', (path) => {
    expect(OPEN_FILES.test(path)).toBe(true);
  });

  it.each([
    '/',
    '/app',
    '/recipe/abc',
    '/api/recipes',
    '/connect',
    '/oauth/authorize',
  ])('keeps %s to this site', (path) => {
    expect(OPEN_FILES.test(path)).toBe(false);
  });

  it('lets the social cards, the icons and the manifest be cached for a day', () => {
    expect([...RARELY_CHANGING].sort()).toEqual([
      '/apple-icon.png',
      '/favicon.ico',
      '/icon.svg',
      '/manifest.webmanifest',
      '/opengraph-image.png',
      '/twitter-image.png',
    ]);
  });

  it('names only the Google photo host as an outside picture source', () => {
    expect(EXTRA_IMG_SOURCES).toEqual(['https://lh3.googleusercontent.com']);
  });

  it('adds no directives of its own', () => {
    expect(EXTRA_DIRECTIVES).toEqual([]);
  });
});
