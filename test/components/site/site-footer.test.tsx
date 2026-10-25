import { describe, expect, it } from '@jest/globals';

import { SiteFooter } from '@/components/site/site-footer';
import { html } from '../render';

describe('SiteFooter', () => {
  const out = html(<SiteFooter />);

  it('is the page’s footer landmark, with the wordmark', () => {
    expect(out.startsWith('<footer')).toBe(true);
    expect(out).toContain('chowdown');
  });

  it('links only to pages anyone can open', () => {
    const hrefs = [...out.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(
      expect.arrayContaining(['/#features', '/#faq', '/privacy']),
    );
    expect(hrefs.some((href) => href?.startsWith('/app'))).toBe(false);
    expect(hrefs.some((href) => href?.startsWith('/api'))).toBe(false);
  });

  it('groups the links under headings', () => {
    expect(out).toMatch(/<h2[^>]*>Explore<\/h2>/);
    expect(out).toMatch(/<h2[^>]*>About<\/h2>/);
  });

  it('keeps its decoration from assistive technology', () => {
    expect(out).toContain('aria-hidden="true"');
  });
});
