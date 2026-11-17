import { describe, expect, it } from '@jest/globals';

import { SiteFooter } from '@/components/site/site-footer';
import { html } from '../render';

const H2_ABOUT_H2 = /<h2[^>]*>About<\/h2>/u;
const H2_EXPLORE_H2 = /<h2[^>]*>Explore<\/h2>/u;

describe('SiteFooter', () => {
  const out = html(<SiteFooter />);

  it('is the page’s footer landmark, with the wordmark', () => {
    expect(out.startsWith('<footer')).toBe(true);
    expect(out).toContain('Chowdown');
  });

  it('links only to pages anyone can open', () => {
    const hrefs = Array.from(out.matchAll(/href="([^"]+)"/gu), (m) => m[1]);
    expect(hrefs).toEqual(
      expect.arrayContaining(['/#features', '/#faq', '/privacy', '/terms']),
    );
    expect(hrefs.some((href) => href?.startsWith('/app'))).toBe(false);
    expect(hrefs.some((href) => href?.startsWith('/api'))).toBe(false);
  });

  it('groups the links under headings', () => {
    expect(out).toMatch(H2_EXPLORE_H2);
    expect(out).toMatch(H2_ABOUT_H2);
  });

  it('keeps its decoration from assistive technology', () => {
    expect(out).toContain('aria-hidden="true"');
  });
});
