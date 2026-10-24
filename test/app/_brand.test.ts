import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BRAND_NAME,
  BRAND_URL,
  CRAWLABLE_PATHS,
  MANIFEST_EXTRAS,
  PRIVATE_PATHS,
  SITEMAP_PAGES,
} from '@/app/_brand';
import { PRIVACY_LAST_UPDATED } from '@/utils/site';
import { pngSize } from '../png';

describe('the brand', () => {
  it('is named and placed as the site says', () => {
    expect(BRAND_NAME).toBe('chowdown');
    expect(BRAND_URL).toBe('https://chowdown.apps.mrida.ng');
  });
});

describe('what crawlers may read', () => {
  it('is the landing page and the privacy page only', () => {
    expect(CRAWLABLE_PATHS).toEqual(['/$', '/privacy']);
    expect(SITEMAP_PAGES.map((page) => page.path)).toEqual(['/', '/privacy']);
  });

  it('dates the privacy page by the day its text last changed', () => {
    expect(SITEMAP_PAGES[1]?.lastModified).toBe(PRIVACY_LAST_UPDATED);
    expect(SITEMAP_PAGES[0]?.lastModified).toBeUndefined();
  });

  it('keeps crawlers out of somebody’s own recipes and the account endpoints', () => {
    expect(PRIVATE_PATHS).toEqual(
      expect.arrayContaining([
        '/app/',
        '/app$',
        '/app?',
        '/recipe/',
        '/recipes/',
        '/connect',
        '/api/',
        '/auth/',
        '/oauth/',
      ]),
    );
  });

  // `Disallow: /app` is a prefix rule and used to hide /apple-icon.png too.
  it('does not let the app’s own paths hide its icon, whose name starts the same way', () => {
    expect(PRIVATE_PATHS).not.toContain('/app');
  });
});

describe('what the installed app offers', () => {
  const root = process.cwd();

  it('shows Chrome its richer install dialog: screenshots for both form factors, each a real PNG', () => {
    const shots = MANIFEST_EXTRAS.screenshots ?? [];
    expect(shots.filter((s) => s.form_factor === 'wide')).toHaveLength(2);
    expect(shots.filter((s) => s.form_factor === 'narrow')).toHaveLength(3);
    expect(shots.length).toBeLessThanOrEqual(8);
    for (const shot of shots) {
      expect(shot.type).toBe('image/png');
      expect(shot.label).toBeTruthy();
      expect(shot.src.startsWith('/screenshots/')).toBe(true);
      expect(existsSync(path.join(root, 'public', shot.src))).toBe(true);
      const { width, height } = pngSize(path.join(root, 'public', shot.src));
      expect(shot.sizes).toBe(`${width}x${height}`);
    }
  });

  it('can be shared to: a GET to the add-recipes page carrying title, text and url', () => {
    expect(MANIFEST_EXTRAS.share_target).toEqual({
      action: '/recipes/add',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: { title: 'title', text: 'text', url: 'url' },
    });
  });

  it('shares to a page that exists', () => {
    expect(
      existsSync(
        path.join(root, 'src/app/(site)/(pages)/recipes/add/page.tsx'),
      ),
    ).toBe(true);
  });

  it('has a shortcut each for the library, the favourites and adding a recipe', () => {
    expect(MANIFEST_EXTRAS.shortcuts?.map((s) => s.url)).toEqual([
      '/app',
      '/app?fav=1',
      '/recipes/add',
    ]);
  });
});

describe('what assistants are told', () => {
  const llms = readFileSync(
    path.join(process.cwd(), 'public/llms.txt'),
    'utf8',
  );

  it('names the MCP address and does not hand-list tools that may change', () => {
    expect(llms).toContain(`${BRAND_URL}/mcp`);
    expect(llms).not.toMatch(/\b[a-z]+(_[a-z]+)+\b/);
  });

  it('puts the Cooklang spec under Optional, where outside links belong', () => {
    expect(llms.split('\n## Optional')[1]).toContain('https://cooklang.org/');
  });
});
