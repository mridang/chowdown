/**
 * @packageDocumentation
 *
 * Structured data (schema.org, as JSON-LD) for the public landing page, so
 * search engines and assistants can say what the site is without guessing.
 */

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

/** The landing page's structured data: the organisation, the site and the app. */
export function landingJsonLd(): Readonly<Record<string, unknown>> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'en',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Any',
        browserRequirements:
          'Requires a modern web browser and a Google account',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Recipes kept as plain Cooklang text files in your own Google Drive',
          'Search, filter and scale recipes, and switch between metric and US units',
          'Cook mode with one step at a time',
          'Connect ChatGPT, Claude or any MCP assistant to your recipes',
        ],
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}

/**
 * JSON-LD as text that is safe to put inside a `<script>` element: a `<` in the
 * data can never close the tag or open a comment.
 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
