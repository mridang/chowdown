/**
 * @packageDocumentation
 *
 * What the site calls itself and where it lives, in one place for the page
 * metadata, the structured data and outbound fetches (see `http/safe-fetch.ts`).
 * The first four constants are in every app; the rest are this app's own.
 */

/** The name of the site, as it appears in titles and structured data. */
export const SITE_NAME = 'chowdown';
/** The site's public address, with no trailing slash. */
export const SITE_URL = 'https://chowdown.apps.mrida.ng';

/** The site's default page title. */
export const SITE_TITLE =
  'chowdown: your recipes, kept in your own Google Drive';
/** The site's default description, for page metadata and structured data. */
export const SITE_DESCRIPTION =
  'Keep every recipe as a plain text file in your own Google Drive, then ' +
  'search, scale and cook from them, and ask your AI assistant what to make.';

/** The address assistants connect to (the connect page and the home page's call to action). */
export const MCP_URL = `${SITE_URL}/mcp`;

/**
 * Where to report a security problem. It is published in `security.txt` and in
 * the plain-text disclosure policy (`public/security-policy.txt`), which the
 * `Policy:` field of `security.txt` points at.
 */
export const SECURITY_CONTACT = 'mailto:mridang.agarwalla@gmail.com';

/**
 * The disclosure policy a researcher is sent to by `security.txt` (RFC 9116
 * section 2.5.7 asks for a page that says how reports are handled).
 */
export const SECURITY_POLICY_URL = `${SITE_URL}/security-policy.txt`;

/**
 * When the privacy notice last changed, as an ISO date. The sitemap publishes
 * it as the page's `lastmod`, so bump it together with the "Last updated" line
 * on the privacy page.
 */
export const PRIVACY_LAST_UPDATED = '2026-10-18';

/**
 * When this site's Global Privacy Control statement (`/.well-known/gpc.json`)
 * was last reviewed, as an ISO date. Move it forward only when the claim is
 * re-checked: nothing here sells or shares personal data.
 */
export const GPC_LAST_UPDATE = '2026-10-19';
