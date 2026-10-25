/**
 * @packageDocumentation
 *
 * What the MCP server says about itself: its name, version, description and
 * icons, the capabilities it really has, and the guidance an assistant reads
 * before it uses the tools. The same answers go out in the older revisions'
 * `initialize` reply, in `server/discover`, and (for the identity) in the
 * `_meta` of every result of the newest revision.
 */

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/utils/site';

/**
 * The version of this server. It follows `package.json`, and a test fails if the
 * two drift apart, so bump them together. (The file is not read at run time: a
 * Worker has no file system, and importing the whole manifest would ship it in
 * the bundle.)
 */
export const SERVER_VERSION = '0.1.0';

/** The identifier of the MCP Apps extension, which carries the interactive views. */
export const UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';

/** The `_meta` key under which a result of the newest revision names its server. */
export const SERVER_INFO_META_KEY = 'io.modelcontextprotocol/serverInfo';

/**
 * Icons for connector lists, as absolute HTTPS addresses on this site (the spec
 * wants icons fetched from the server's own origin, and PNG is the format every
 * client must handle). The files are in `public/icons` and also back the web
 * app manifest.
 */
const SERVER_ICONS = [
  {
    src: `${SITE_URL}/icons/icon-192.png`,
    mimeType: 'image/png',
    sizes: ['192x192'],
  },
  {
    src: `${SITE_URL}/icons/icon-512.png`,
    mimeType: 'image/png',
    sizes: ['512x512'],
  },
] as const;

/** The name, version and look this server reports about itself. */
export const SERVER_INFO = {
  name: SITE_NAME,
  title: SITE_NAME,
  version: SERVER_VERSION,
  description: SITE_DESCRIPTION,
  websiteUrl: SITE_URL,
  icons: SERVER_ICONS,
} as const;

/**
 * What this server can do, as announced in the handshake and in discovery.
 * Only things it really does are listed: tools, resources (the interactive
 * views and the user's recipes; the list never changes while running, so there
 * is no `listChanged` and nothing to subscribe to), prompts (starting points a
 * host shows as slash commands) and the MCP Apps extension that those views belong
 * to. The extension needs no settings, so its entry is empty.
 *
 * Hosts that do not know the extension still get every tool's text result, so
 * the tools are not withheld from them: the server keeps no record of what a
 * client said in its `initialize`, and what it lists must not vary per caller.
 */
export const CAPABILITIES = {
  tools: {},
  resources: {},
  prompts: {},
  extensions: { [UI_EXTENSION_ID]: {} },
} as const;

/**
 * What an assistant should know before using the tools. Kept to what the tool
 * descriptions cannot say on their own, which is how to choose between tools;
 * a host may put all of it in the model's context, so a test caps its length.
 */
export const INSTRUCTIONS =
  "chowdown keeps the user's cooking recipes as Cooklang files in their own Google Drive. " +
  'A tool that takes a recipe accepts its name, or its id (shown next to every recipe in a list) when two names are alike; ' +
  'long lists come a page at a time, and `offset` asks for the next. ' +
  'To add a recipe from a web page, open the page yourself and call import_recipe with the ' +
  "recipe's text as `content` (plus its `url` and photo links); chowdown converts it " +
  'to Cooklang, so do not write the Cooklang yourself, and it may fetch that page once more to ' +
  'find a cover image. Use add_recipe only for a recipe the user dictates as Cooklang, ' +
  'capture_idea for a wish with no recipe yet, and log_cooking or annotate_recipe for notes. ' +
  "To find recipes: browse_recipes for what the user feels like eating ('something vegetarian', 'a quick " +
  "pescatarian dinner'), recipes_from_ingredients for what they have ('3 tomatoes and 400 g of pasta'; " +
  'tell them what the near misses lack), search_recipes for part of a name, find_recipes for what a recipe ' +
  'is about; list_filters shows what the collection holds. ' +
  'Call set_measurement_system when the user asks for metric, US or imperial units, ' +
  'favourite_recipe when they love or want to keep a recipe, tag_recipe when they ask for tags ' +
  "(it may fetch the recipe's source page once to find a cover), and set_recipe_images when a " +
  'recipe has no picture. ' +
  `If a tool says Google Drive isn't connected, ask the user to connect it at ${SITE_URL}/app.`;
