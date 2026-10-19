import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * The paths crawlers must stay out of: somebody's own recipes, the sign-in
 * flow and the account endpoints.
 *
 * Robots rules match by prefix (RFC 9309 section 2.2.2), so a bare `/app` would
 * also hide `/apple-icon.png`. `/app/` covers anything below the app,
 * `/app$` is the page itself, and `/app?` covers its query forms such as
 * `/app?fav=1` (matching is done on the path plus the query).
 */
const PRIVATE_PATHS = [
  '/app/',
  '/app$',
  '/app?',
  '/recipe/',
  '/recipes/',
  '/connect',
  '/api/',
  '/oauth/',
  '/rpc/',
] as const;

/**
 * Crawlers may read the landing page and the privacy page; everything else is
 * somebody's own recipes or an account endpoint, so they are asked to stay out.
 * (Every one of those pages also says "noindex, nofollow" itself.)
 *
 * One group, for every crawler, on purpose. Search and assistant agents
 * (Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot
 * and the like) may read the two public pages, and so may the crawlers that
 * gather training data: both public pages are marketing copy and a privacy
 * notice, and there is nothing private for any of them to read. A crawler that
 * matches a named group ignores this one, so a future per-bot group has to
 * repeat `PRIVATE_PATHS`. (`Host:` is left out: only Yandex ever read it.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/privacy'],
        disallow: [...PRIVATE_PATHS],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
