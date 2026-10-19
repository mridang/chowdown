/**
 * @packageDocumentation
 *
 * What the site calls itself and where it lives, in one place for the page
 * metadata, the structured data, the sitemap and the files under `/.well-known`.
 */

export const SITE_NAME = 'chowdown';
export const SITE_URL = 'https://chowdown.apps.mrida.ng';

/** The address assistants connect to (the connect page and the home page's call to action). */
export const MCP_URL = `${SITE_URL}/api/mcp`;

export const SITE_TITLE =
  'chowdown: your recipes, kept in your own Google Drive';
export const SITE_DESCRIPTION =
  'Keep every recipe as a plain text file in your own Google Drive, then ' +
  'search, scale and cook from them, and ask your AI assistant what to make.';

/** Where to report a security problem (also listed on the privacy page). */
export const SECURITY_CONTACT = 'mailto:mridang.agarwalla@gmail.com';
