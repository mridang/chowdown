import { describe, expect, it } from '@jest/globals';

import { NOT_FOUND_LINK, NOT_FOUND_NOTE } from '@/app/_brand';
import NotFound, { metadata } from '@/app/not-found';
import { html } from '../components/render';

const HREF_BACK_TO = /<a [^>]*href="\/"[^>]*>Back to the home page<\/a>/u;
const H1_WE_COULDN = /<h1[^>]*>We couldn&#x27;t find that page<\/h1>/u;

describe('NotFound', () => {
  const out = html(<NotFound />);

  it('says the page could not be found, as the page’s heading', () => {
    expect(out).toMatch(H1_WE_COULDN);
  });

  it('says what may have happened', () => {
    expect(out).toContain(NOT_FOUND_NOTE);
  });

  it.each(NOT_FOUND_LINK ? [NOT_FOUND_LINK] : [])(
    'offers a way back home, and the app’s own second way if it has one (%j)',
    (link) => {
      expect(out).toMatch(HREF_BACK_TO);
      expect(out).toContain(`href="${link.href}"`);
      expect(out).toContain(`>${link.label}</a>`);
    },
  );

  it('has a tab title of its own, to which the layout’s template adds the app’s name', () => {
    expect(metadata.title).toBe('Page not found');
  });

  it('asks crawlers not to index it', () => {
    expect(metadata.robots).toEqual({ index: false });
  });
});
