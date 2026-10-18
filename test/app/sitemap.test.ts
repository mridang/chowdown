import { describe, expect, it } from '@jest/globals';

import sitemap from '../../src/app/sitemap';

describe('sitemap', () => {
  it('lists only the two public pages, by full address', () => {
    expect(sitemap().map((e) => e.url)).toEqual([
      'https://chowdown.apps.mrida.ng/',
      'https://chowdown.apps.mrida.ng/privacy',
    ]);
  });
});
