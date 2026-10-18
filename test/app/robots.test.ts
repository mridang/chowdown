import { describe, expect, it } from '@jest/globals';

import robots from '../../src/app/robots';

describe('robots.txt', () => {
  const rule = (
    robots().rules as { allow: string[]; disallow: string[] }[]
  )[0]!;

  it('lets crawlers read only the landing page and the privacy page', () => {
    expect(rule.allow).toEqual(['/$', '/privacy']);
  });

  it('asks them to stay out of every private page and endpoint', () => {
    for (const path of [
      '/app',
      '/recipe/',
      '/recipes/',
      '/connect',
      '/api/',
      '/oauth/',
      '/rpc/',
    ]) {
      expect(rule.disallow).toContain(path);
    }
  });

  it('points crawlers at the sitemap', () => {
    expect(robots().sitemap).toBe('https://chowdown.apps.mrida.ng/sitemap.xml');
  });
});
