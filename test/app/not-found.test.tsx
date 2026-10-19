import { describe, expect, it } from '@jest/globals';

import NotFound, { metadata } from '../../src/app/not-found';
import { html } from '../components/render';

describe('NotFound', () => {
  const out = html(<NotFound />);

  it('says the page could not be found, as the page’s heading', () => {
    expect(out).toMatch(/<h1[^>]*>We couldn&#x27;t find that page<\/h1>/);
  });

  it('offers two ways back', () => {
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>Back to the home page<\/a>/);
    expect(out).toMatch(/<a [^>]*href="\/app"[^>]*>Browse recipes<\/a>/);
  });

  it('asks crawlers not to index it', () => {
    expect(metadata.robots).toEqual({ index: false });
  });
});
