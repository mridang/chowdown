/**
 * @packageDocumentation
 *
 * The interactive views the MCP server offers next to its tools (the MCP Apps
 * extension): a recipe card and a recipe list, each a small page the assistant's
 * host shows in a frame. This module names them, says how they should be
 * framed, and holds their HTML.
 */

import { html as recipeCardHtml } from '../../views/generated/recipe-card';
import { html as recipeListHtml } from '../../views/generated/recipe-list';

/**
 * MIME type the MCP Apps spec requires for UI resources. Defined locally so the
 * Worker bundle stays lean (the ext-apps/server package pulls the Node SDK in);
 * a unit test asserts this equals the official `RESOURCE_MIME_TYPE` constant.
 */
export const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/** The `ui://` URI of the interactive recipe card View. */
export const CARD_RESOURCE_URI = 'ui://recipe/card.html';

/** The `ui://` URI of the recipe list View. */
export const LIST_RESOURCE_URI = 'ui://recipe/list.html';

/** UI metadata attached to the card resource (rendering + CSP preferences). */
export const CARD_UI_META = {
  ui: {
    prefersBorder: true,
    domain: 'https://chowdown.apps.mrida.ng',
    csp: {
      connectDomains: [] as readonly string[],
      resourceDomains: [] as readonly string[],
    },
  },
  'openai/widgetPrefersBorder': true,
  'openai/widgetDomain': 'https://chowdown.apps.mrida.ng',
} as const;

/** The app's UI resources, served via resources/list and resources/read. */
export const APP_RESOURCES = [
  {
    uri: CARD_RESOURCE_URI,
    name: 'Recipe card',
    description: 'Interactive chowdown recipe card.',
    html: recipeCardHtml,
  },
  {
    uri: LIST_RESOURCE_URI,
    name: 'Recipe list',
    description: 'The chowdown recipe list.',
    html: recipeListHtml,
  },
] as const;
