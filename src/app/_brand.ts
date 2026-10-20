/**
 * @packageDocumentation
 *
 * Everything about this app's identity that the shared app shell reads: its
 * name and descriptions, its colours, what search engines may crawl, what the
 * installed app offers, and the wording of the not-found and error pages. The
 * shell files (`layout.tsx`, `_metadata.ts`, `manifest.ts`, `robots.ts`,
 * `sitemap.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx`) are the same
 * in every app, and this file is where they differ. It keeps the same export
 * names in every app, and holds values only: no components, no side effects.
 */

import type { MetadataRoute } from 'next';

import {
  PRIVACY_LAST_UPDATED,
  SECURITY_CONTACT as SITE_SECURITY_CONTACT,
  SECURITY_POLICY_URL as SITE_SECURITY_POLICY_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site';

/** The name of the app, as the wordmark, the tab title suffix and the home-screen label. */
export const BRAND_NAME = SITE_NAME;

/** The name where space is short: under the home-screen icon, and as the installed app's short name. */
export const BRAND_SHORT_NAME = SITE_NAME;

/** The small descriptor under the wordmark and on the social card. */
export const BRAND_TAGLINE = 'Recipe keeper';

/** The title of the home page, and of any page that does not set its own. */
export const BRAND_TITLE = SITE_TITLE;

/** What search results and social cards say about the app. */
export const BRAND_DESCRIPTION = SITE_DESCRIPTION;

/** The public address of the app, with no trailing slash. */
export const BRAND_URL = SITE_URL;

/** Where to report a security problem: published in `security.txt` and the security policy. */
export const SECURITY_CONTACT = SITE_SECURITY_CONTACT;

/** The disclosure policy that `security.txt` points researchers to (`public/security-policy.txt`). */
export const SECURITY_POLICY_URL = SITE_SECURITY_POLICY_URL;

/** The marigold of the header strip: the browser's own bar and the installed app's title bar. */
export const THEME_COLOR = '#ffb100';

/** The page colour, shown while the installed app starts. */
export const BACKGROUND_COLOR = '#fbf8f2';

/**
 * Which colour schemes the app is drawn in. The site has no dark theme, and
 * saying so stops Android's "auto dark" from inverting the pages and keeps
 * form controls and scrollbars light.
 */
export const COLOR_SCHEME = 'only light';

/**
 * Whether pages may be indexed unless they say otherwise. Almost every page is
 * someone's own recipes, so crawlers are told to keep out; the public pages
 * opt back in with `pageMetadata({ index: true })`. robots.txt and an
 * `X-Robots-Tag` header (see `lib/http/headers.ts`) say the same thing.
 */
export const INDEX_BY_DEFAULT = false;

/** The only pages a crawler may read; everything else is private. */
export const CRAWLABLE_PATHS: readonly string[] = ['/$', '/privacy'];

/**
 * The paths crawlers must stay out of: somebody's own recipes, the sign-in
 * flow and the account endpoints.
 *
 * Robots rules match by prefix (RFC 9309 section 2.2.2), so a bare `/app` would
 * also hide `/apple-icon.png`. `/app/` covers anything below the app,
 * `/app$` is the page itself, and `/app?` covers its query forms such as
 * `/app?fav=1` (matching is done on the path plus the query).
 */
export const PRIVATE_PATHS: readonly string[] = [
  '/app/',
  '/app$',
  '/app?',
  '/recipe/',
  '/recipes/',
  '/connect',
  '/api/',
  '/oauth/',
  '/rpc/',
];

/**
 * The pages worth listing in the sitemap. Only a page with an honest `lastmod`
 * (the day its text last changed) is given one; the landing page changes with
 * the site, so it gets none rather than a made-up date.
 */
export const SITEMAP_PAGES: readonly Readonly<{
  path: string;
  lastModified?: string;
}>[] = [
  { path: '/' },
  { path: '/privacy', lastModified: PRIVACY_LAST_UPDATED },
];

/** The name of the installed app, where there is room for more than the short name. */
export const MANIFEST_NAME = `${BRAND_NAME} — recipe keeper`;

/** What the install dialog says the app is. */
export const MANIFEST_DESCRIPTION =
  'Your recipes, kept as plain text in your own Google Drive. Search, scale and cook from them, and ask your AI assistant about them.';

/** The store categories of the installed app. */
export const MANIFEST_CATEGORIES: readonly string[] = ['food', 'lifestyle'];

/**
 * The launcher icon of one shortcut. Android draws shortcut icons at 48dp and
 * wants at least half the screen's density-scaled size, and web.dev recommends a
 * single 192px PNG when one size has to do, so that is what these are.
 */
function shortcutIcon(name: 'recipes' | 'favourites' | 'add'): {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
} {
  return {
    src: `/icons/shortcut-${name}-192.png`,
    sizes: '192x192',
    type: 'image/png',
  };
}

/**
 * What only this app's installed form offers, on top of the manifest every app
 * has: install-dialog screenshots, a share target and launcher shortcuts.
 *
 * Chrome and Edge show the screenshots in their install dialog (the richer
 * install UI), which they only do when at least one exists per form factor.
 * They are drawn from a throwaway demo account with invented recipes and drawn
 * pictures, so nothing in them belongs to a real person. Rules the browsers
 * enforce, kept by test/app/manifest.test.ts: PNG or JPEG, each side 320 to
 * 3840px, the long side at most 2.3 times the short one, one aspect ratio per
 * form factor, at most eight.
 *
 * Chrome and Edge offer the app in the system share sheet once it is
 * installed. A GET to the add-recipes page carries the shared title, text and
 * address as query parameters; the page puts the address (or text) into the
 * importer's box and waits for the person to press the button, since an import
 * costs AI budget. See `recipes/add/_components/shared-input.ts`.
 */
export const MANIFEST_EXTRAS: Pick<
  MetadataRoute.Manifest,
  'screenshots' | 'share_target' | 'shortcuts'
> = {
  screenshots: [
    {
      src: '/screenshots/wide-1-library.png',
      sizes: '1280x800',
      type: 'image/png',
      form_factor: 'wide',
      label: 'Your recipe library, searchable and filterable',
    },
    {
      src: '/screenshots/wide-2-recipe.png',
      sizes: '1280x800',
      type: 'image/png',
      form_factor: 'wide',
      label: 'A recipe with its photo, facts and method',
    },
    {
      src: '/screenshots/narrow-1-library.png',
      sizes: '750x1624',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Your recipe library on a phone',
    },
    {
      src: '/screenshots/narrow-2-recipe.png',
      sizes: '750x1624',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'A recipe on a phone',
    },
    {
      src: '/screenshots/narrow-3-cook.png',
      sizes: '750x1624',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Cook mode: one big step at a time, with timers',
    },
  ],
  share_target: {
    action: '/recipes/add',
    method: 'GET',
    enctype: 'application/x-www-form-urlencoded',
    params: { title: 'title', text: 'text', url: 'url' },
  },
  shortcuts: [
    {
      name: 'Recipes',
      url: '/app',
      description: 'Browse and search your recipes',
      icons: [shortcutIcon('recipes')],
    },
    {
      name: 'Favourites',
      url: '/app?fav=1',
      description: 'Your favourite recipes',
      icons: [shortcutIcon('favourites')],
    },
    {
      name: 'Add recipes',
      url: '/recipes/add',
      description: 'Save a new recipe',
      icons: [shortcutIcon('add')],
    },
  ],
};

/** What the not-found page says under its heading. */
export const NOT_FOUND_NOTE =
  'The link may be out of date, or the recipe may have been moved or deleted.';

/** A second way back from the not-found page, beside "Back to the home page". */
export const NOT_FOUND_LINK: Readonly<{ href: string; label: string }> | null =
  { href: '/app', label: 'Browse recipes' };

/** The reassurance on the error pages, after "Something went wrong". */
export const ERROR_REASSURANCE =
  'Try again in a moment, and your recipes will still be in your Drive either way.';
