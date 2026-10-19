import type { MetadataRoute } from 'next';

import { PRIVACY_LAST_UPDATED, SITE_URL } from '@/lib/site';

/**
 * The pages worth indexing: the landing page and the privacy page. Only the
 * privacy page has an honest `lastmod` (the day its text last changed); the
 * landing page changes with the site, so it gets none rather than a made-up
 * date. `changefreq` and `priority` are ignored by Google and Bing, so they
 * are not sent.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(`${PRIVACY_LAST_UPDATED}T00:00:00Z`),
    },
  ];
}
