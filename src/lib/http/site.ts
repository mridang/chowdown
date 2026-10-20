/**
 * @packageDocumentation
 *
 * What differs from one app to the next in the shared HTTP security code
 * (`headers.ts`, `csp.ts`): the pages search engines may index, the files other
 * sites may load, the small files that may be cached for a day, and the few
 * outside places and extra rules a page's policy needs. Everything else in
 * those files is the same in every app.
 */

/** The pages search engines may index. Everything else is private. */
export const PUBLIC_PAGES: ReadonlySet<string> = new Set(['/', '/privacy']);

/**
 * Which other sites may load a file as a picture, script or style. Our pages
 * and data are for this site only (`same-site`); the few files other sites
 * embed or fetch on purpose (the social card, the icons, the manifest and the
 * plain-text files at the root) are open to all and not marked noindex.
 */
export const OPEN_FILES =
  /^\/(opengraph-image\.png|twitter-image\.png|icon\.svg|apple-icon\.png|favicon\.ico|manifest\.webmanifest|robots\.txt|sitemap\.xml|llms\.txt|security-policy\.txt|\.well-known\/.*|icons\/.*|screenshots\/.*)$/;

/** The small files that rarely change, and for which a stale copy is harmless. */
export const RARELY_CHANGING: ReadonlySet<string> = new Set([
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.png',
  '/favicon.ico',
  '/opengraph-image.png',
  '/twitter-image.png',
]);

/**
 * The outside places pages may load pictures from, besides this site (`'self'`)
 * and inline `data:` pictures.
 * The signed-in person's Google photo is the only picture from elsewhere;
 * recipe photos come through our own address.
 */
export const EXTRA_IMG_SOURCES: readonly string[] = [
  'https://lh3.googleusercontent.com',
];

/**
 * Directives only this app adds to its policy. None.
 */
export const EXTRA_DIRECTIVES: readonly string[] = [];
