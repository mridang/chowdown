import { describe, expect, it } from '@jest/globals';

import sitemap from '../../src/app/sitemap';
import { PRIVACY_LAST_UPDATED } from '../../src/lib/site';

describe('sitemap', () => {
  const entries = sitemap();

  it('lists only the two public pages, by full address', () => {
    expect(entries.map((e) => e.url)).toEqual([
      'https://chowdown.apps.mrida.ng/',
      'https://chowdown.apps.mrida.ng/privacy',
    ]);
  });

  it('dates the privacy page by the day its text last changed', () => {
    expect(entries[1]?.lastModified).toEqual(
      new Date(`${PRIVACY_LAST_UPDATED}T00:00:00Z`),
    );
  });

  it('gives the landing page no made-up date', () => {
    expect(entries[0]?.lastModified).toBeUndefined();
  });

  it('does not send the hints search engines ignore', () => {
    for (const entry of entries) {
      expect(entry.changeFrequency).toBeUndefined();
      expect(entry.priority).toBeUndefined();
    }
  });
});
