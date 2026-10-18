import type { MetadataRoute } from 'next';

/**
 * Crawlers may read the landing page and the privacy page; everything else is
 * somebody's own recipes or an account endpoint, so they are asked to stay out.
 * (Every one of those pages also says "noindex, nofollow" itself.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/privacy'],
        disallow: [
          '/app',
          '/recipe/',
          '/recipes/',
          '/connect',
          '/api/',
          '/oauth/',
          '/rpc/',
        ],
      },
    ],
  };
}
